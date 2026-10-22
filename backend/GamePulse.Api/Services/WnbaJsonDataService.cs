using System.Globalization;
using System.Text.Json;
using GamePulse.Api.Models.Wnba;
using Microsoft.Extensions.Caching.Memory;

namespace GamePulse.Api.Services;

public sealed class WnbaDataException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public sealed class WnbaJsonDataService : IDisposable
{
    private readonly string _root;
    private readonly ILogger<WnbaJsonDataService> _logger;
    // Bound the number of decoded seasons retained on the free Render instance.
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 2 });
    private readonly SemaphoreSlim _loadGate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public WnbaJsonDataService(IHostEnvironment environment, IConfiguration configuration,
        ILogger<WnbaJsonDataService> logger)
    {
        var configured = configuration["Wnba:DataPath"];
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(environment.ContentRootPath, "Data", "processed", "wnba")
            : Path.GetFullPath(configured, environment.ContentRootPath);
        _logger = logger;
    }

    public async Task<int[]> GetSeasonsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var path = Path.Combine(_root, "seasons.json");
            if (!File.Exists(path))
                throw new WnbaDataException(503, "WNBA data has not been imported. Run the supplied WNBA import script.");
            var years = await ReadAsync<int[]>(path, cancellationToken);
            if (years.Length == 0 || years.Any(y => y < 1997 || y > 9999))
                throw new JsonException("Invalid WNBA season index.");
            return years.Distinct().OrderDescending().ToArray();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            _logger.LogError(ex, "Unable to read the WNBA season index");
            throw new WnbaDataException(503, "WNBA season data is unavailable or invalid. Check the backend logs and import files.");
        }
    }

    public async Task<WnbaSeasonData> GetSeasonAsync(int? requestedSeason,
        CancellationToken cancellationToken = default)
    {
        var years = await GetSeasonsAsync(cancellationToken);
        var year = requestedSeason ?? years[0];
        if (!years.Contains(year))
            throw new WnbaDataException(404, $"WNBA season {year} has not been imported.");
        if (_cache.TryGetValue<WnbaSeasonData>(year, out var cached) && cached is not null)
            return cached;
        await _loadGate.WaitAsync(cancellationToken);
        try
        {
            if (_cache.TryGetValue<WnbaSeasonData>(year, out cached) && cached is not null)
                return cached;
            var directory = Path.Combine(_root, "seasons", year.ToString(CultureInfo.InvariantCulture));
            var teams = await ReadAsync<WnbaTeam[]>(Path.Combine(directory, "teams.json"), cancellationToken);
            var players = await ReadAsync<WnbaPlayer[]>(Path.Combine(directory, "players.json"), cancellationToken);
            var games = await ReadAsync<WnbaGame[]>(Path.Combine(directory, "games.json"), cancellationToken);
            var teamStats = await ReadAsync<WnbaGameStat[]>(Path.Combine(directory, "team_game_stats.json"), cancellationToken);
            var playerStats = await ReadAsync<WnbaGameStat[]>(Path.Combine(directory, "player_game_stats.json"), cancellationToken);
            var coverage = await ReadAsync<JsonElement>(Path.Combine(directory, "coverage.json"), cancellationToken);
            Validate(year, teams, players, games, teamStats, playerStats, coverage);
            var teamIndex = teams.ToDictionary(t => t.Id);
            foreach (var game in games)
            {
                var home = teamIndex[game.HomeTeamId];
                var away = teamIndex[game.AwayTeamId];
                game.HomeTeamName = home.Name;
                game.HomeTeamAbbreviation = home.Abbreviation;
                game.AwayTeamName = away.Name;
                game.AwayTeamAbbreviation = away.Abbreviation;
            }
            var data = new WnbaSeasonData(year, teams, players, games, teamStats, playerStats, coverage);
            _cache.Set(year, data, new MemoryCacheEntryOptions
            {
                Size = 1, SlidingExpiration = TimeSpan.FromMinutes(15)
            });
            return data;
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
        {
            _logger.LogError(ex, "Unable to load WNBA season {Season}", year);
            throw new WnbaDataException(503, $"WNBA data for {year} is incomplete or invalid. Check the backend logs and reimport that season.");
        }
        finally { _loadGate.Release(); }
    }

    private static async Task<T> ReadAsync<T>(string path, CancellationToken ct)
    {
        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions, ct)
            ?? throw new JsonException($"Unexpected null content in {Path.GetFileName(path)}");
    }

    private static void Validate(int year, WnbaTeam[] teams, WnbaPlayer[] players, WnbaGame[] games,
        WnbaGameStat[] teamStats, WnbaGameStat[] playerStats, JsonElement coverage)
    {
        static bool ValidId(string? id, string kind) => !string.IsNullOrWhiteSpace(id)
            && id.StartsWith($"wnba:stats:{kind}:", StringComparison.Ordinal);
        if (teams.Length == 0 || games.Length == 0 ||
            teams.Any(t => t is null || !ValidId(t.Id, "team") || t.Season != year || t.League != "wnba") ||
            players.Any(p => p is null || !ValidId(p.Id, "player") || p.Season != year || p.League != "wnba") ||
            games.Any(g => g is null || !ValidId(g.Id, "game") || g.Season != year || g.League != "wnba") ||
            teams.Select(t => t.Id).Distinct().Count() != teams.Length ||
            players.Select(p => p.Id).Distinct().Count() != players.Length ||
            games.Select(g => g.Id).Distinct().Count() != games.Length)
            throw new JsonException("Invalid WNBA identities, seasons, or duplicate records.");
        var teamIds = teams.Select(t => t.Id).ToHashSet();
        var playerIds = players.Select(p => p.Id).ToHashSet();
        var gameIndex = games.ToDictionary(g => g.Id);
        if (games.Any(g => !teamIds.Contains(g.HomeTeamId) || !teamIds.Contains(g.AwayTeamId) ||
            g.HomeTeamId == g.AwayTeamId || !DateOnly.TryParseExact(g.GameDate, "yyyy-MM-dd",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out _) ||
            g.HomeScore < 0 || g.AwayScore < 0 || g.Coverage.ValueKind != JsonValueKind.Object))
            throw new JsonException("Invalid WNBA game references, scores, dates, or coverage.");
        foreach (var stat in teamStats.Concat(playerStats))
        {
            if (stat is null || stat.Season != year || !gameIndex.TryGetValue(stat.GameId, out var game) ||
                (stat.TeamId != game.HomeTeamId && stat.TeamId != game.AwayTeamId) ||
                stat.Statistics is null || stat.Sources is null || stat.StatSources is null ||
                stat.Statistics.Any(p => p.Value.HasValue && (!double.IsFinite(p.Value.Value) ||
                    (p.Key != "plusMinus" && p.Value.Value < 0))))
                throw new JsonException("Invalid WNBA statistic references or values.");
        }
        if (playerStats.Any(s => s.PlayerId is null || !playerIds.Contains(s.PlayerId)) ||
            teamStats.Select(s => (s.GameId, s.TeamId)).Distinct().Count() != teamStats.Length ||
            playerStats.Select(s => (s.GameId, s.TeamId, s.PlayerId)).Distinct().Count() != playerStats.Length ||
            players.Any(p => p.TeamIds is null || p.RosterSnapshotTeamIds is null ||
                p.TeamIds.Concat(p.RosterSnapshotTeamIds).Any(id => !teamIds.Contains(id))))
            throw new JsonException("Invalid WNBA player references or duplicate statistics.");
        if (coverage.ValueKind != JsonValueKind.Object ||
            !coverage.TryGetProperty("season", out var season) || !season.TryGetInt32(out var reportYear) || reportYear != year)
            throw new JsonException("Missing or mismatched WNBA coverage report.");
    }

    public static bool SameId(string? canonicalId, string? externalId, string requested)
        => string.Equals(canonicalId, requested, StringComparison.Ordinal) ||
           string.Equals(externalId, requested, StringComparison.Ordinal);

    public void Dispose() { _cache.Dispose(); _loadGate.Dispose(); }
}
