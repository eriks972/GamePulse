using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

// NBA IDs are the same identities used by /players. No name-based joins.
[ApiController]
[Route("api/leagues/nba/player-stats")]
public sealed class NbaPlayerStatisticsController(IWebHostEnvironment env,
    ILogger<NbaPlayerStatisticsController> logger) : ControllerBase
{
    private readonly string root = Path.Combine(env.ContentRootPath, "Data", "processed", "nba_player_stats");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] Types = ["regular-season", "playoffs"];

    private int[] Years() => Directory.Exists(root)
        ? Directory.EnumerateFiles(root, "*.zip").Select(Path.GetFileNameWithoutExtension)
            .Where(n => n is not null && Regex.IsMatch(n, @"^\d{4}$"))
            .Select(n => int.Parse(n!, System.Globalization.CultureInfo.InvariantCulture))
            .Where(n => n >= 1946 && n <= 2100).OrderDescending().ToArray()
        : [];

    [HttpGet("seasons")]
    public IActionResult Seasons() => Ok(Years());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Profile(int id, [FromQuery] int? season = null,
        [FromQuery] string type = "regular-season", [FromQuery] int page = 1,
        CancellationToken ct = default)
    {
        if (id <= 0 || (season is not null && (season < 1946 || season > 2100)) ||
            !Types.Contains(type) || page < 1 || page > 10000)
            return BadRequest(new { message = "Choose a valid NBA player, START-year season, type and page." });
        try
        {
            var years = Years();
            if (years.Length == 0 || (season is not null && !years.Contains(season.Value)))
                return NotFound(new { message = "NBA player statistics have not been imported for this season.", availableSeasons = years });
            var history = new List<NbaPlayerStatSummary>();
            foreach (var year in years)
            {
                var archive = await Read(year, null, type, ct);
                history.AddRange(archive.Summaries.Where(s => s.PlayerId == id));
            }
            var selected = season ?? history.Where(s => s.SeasonType == type).Select(s => (int?)s.Season).Max() ?? years[0];
            // Read selected summary and logs from one open archive: an atomic import
            // cannot mix an older summary with newer game rows in this response.
            var current = await Read(selected, id, type, ct);
            history.RemoveAll(s => s.Season == selected);
            history.AddRange(current.Summaries.Where(s => s.PlayerId == id));
            var summary = current.Summaries.SingleOrDefault(s => s.PlayerId == id && s.SeasonType == type);
            const int size = 25;
            var total = current.Games.Count;
            var pages = (int)Math.Ceiling(total / (double)size);
            if (page > Math.Max(1, pages)) return BadRequest(new { message = "Game-log page is outside the available range." });
            return Ok(new {
                playerId = id, season = selected, seasonType = type,
                status = summary is null ? "no-appearances" : "available", availableSeasons = years,
                history = history.OrderByDescending(s => s.Season).ThenBy(s => s.SeasonType), summary,
                games = current.Games.Skip((page - 1) * size).Take(size),
                pagination = new { page, pageSize = size, total, totalPages = pages },
                coverage = new { current.Manifest.Source, current.Manifest.ImportedAt,
                    note = "Statistics describe imported source coverage. Regular season and playoffs are separate; play-in and NBA Cup finals are excluded.",
                    expectedGames = summary?.Games, availableGames = total,
                    logsReconcile = summary?.LogsReconcile, sourceSeason = selected + 1 }
            });
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidDataException or
            UnauthorizedAccessException or FormatException or InvalidOperationException or KeyNotFoundException)
        {
            logger.LogError(ex, "Unable to read NBA player statistics");
            return StatusCode(503, new { message = "NBA player statistics are temporarily unavailable. Check the imported archive." });
        }
    }

    private async Task<StatArchive> Read(int year, int? player, string type, CancellationToken ct)
    {
        var path = Path.Combine(root, $"{year}.zip");
        await using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
        using var zip = new ZipArchive(file, ZipArchiveMode.Read);
        if (zip.Entries.Select(e => e.FullName).Distinct().Count() != zip.Entries.Count)
            throw new InvalidDataException("Duplicate archive entries");
        var manifest = JsonSerializer.Deserialize<StatManifest>(await Entry(zip, "manifest.json", 1024 * 1024, ct), Json)
            ?? throw new InvalidDataException("Missing manifest");
        if (manifest.SchemaVersion != 1 || manifest.Season != year || manifest.Entries is null ||
            string.IsNullOrWhiteSpace(manifest.Source) || !DateTimeOffset.TryParse(manifest.ImportedAt, out _))
            throw new InvalidDataException("Invalid manifest identity");
        async Task<byte[]> Verified(string name, int limit)
        {
            var bytes = await Entry(zip, name, limit, ct);
            if (!manifest.Entries.TryGetValue(name, out var checksum) ||
                !Convert.ToHexString(SHA256.HashData(bytes)).Equals(checksum, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Statistics checksum mismatch");
            return bytes;
        }
        var summaries = JsonSerializer.Deserialize<List<NbaPlayerStatSummary>>(await Verified("summary.json", 8 * 1024 * 1024), Json)
            ?? throw new InvalidDataException("Missing summaries");
        if (summaries.Count != manifest.SummaryCount || summaries.Any(s => s.PlayerId <= 0 || s.Season != year ||
            !Types.Contains(s.SeasonType) || s.Games < 1 || s.Totals is null || s.PerGame is null || s.Shooting is null) ||
            summaries.Select(s => (s.PlayerId, s.SeasonType)).Distinct().Count() != summaries.Count)
            throw new InvalidDataException("Invalid season summaries");
        var games = new List<JsonElement>();
        if (player is not null)
        {
            var name = $"players/{player}/{type}.json";
            if (manifest.Entries.ContainsKey(name))
                games = JsonSerializer.Deserialize<List<JsonElement>>(await Verified(name, 512 * 1024), Json)
                    ?? throw new InvalidDataException("Invalid game rows");
            var summary = summaries.SingleOrDefault(s => s.PlayerId == player && s.SeasonType == type);
            if (games.Count != (summary?.AvailableGameLogs ?? 0))
                throw new InvalidDataException("Game rows disagree with summary coverage");
        }
        return new(manifest, summaries, games);
    }

    private static async Task<byte[]> Entry(ZipArchive zip, string name, int limit, CancellationToken ct)
    {
        var entry = zip.GetEntry(name) ?? throw new InvalidDataException($"Missing {name}");
        if (entry.Length > limit) throw new InvalidDataException("Statistics entry exceeds size limit");
        await using var stream = entry.Open();
        using var memory = new MemoryStream();
        await stream.CopyToAsync(memory, ct);
        if (memory.Length > limit) throw new InvalidDataException("Statistics entry exceeds size limit");
        return memory.ToArray();
    }
    private sealed record StatArchive(StatManifest Manifest, List<NbaPlayerStatSummary> Summaries, List<JsonElement> Games);
    private sealed class StatManifest
    {
        public int SchemaVersion { get; set; }
        public int Season { get; set; }
        public string Source { get; set; } = "";
        public string ImportedAt { get; set; } = "";
        public int SummaryCount { get; set; }
        public Dictionary<string, string> Entries { get; set; } = [];
    }
}

public sealed class NbaPlayerStatSummary
{
    public int PlayerId { get; set; }
    public string PlayerName { get; set; } = "";
    public int Season { get; set; }
    public string SeasonType { get; set; } = "";
    public string TeamAbbreviation { get; set; } = "";
    public int Games { get; set; }
    public Dictionary<string, double> Totals { get; set; } = [];
    public Dictionary<string, double> PerGame { get; set; } = [];
    public Dictionary<string, double?> Shooting { get; set; } = [];
    public int AvailableGameLogs { get; set; }
    public bool LogsReconcile { get; set; }
}
