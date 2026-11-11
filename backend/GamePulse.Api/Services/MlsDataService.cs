using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using GamePulse.Api.Models.Mls;

namespace GamePulse.Api.Services;

public sealed class MlsDataException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed class MlsDataService(IHostEnvironment environment, IConfiguration configuration, ILogger<MlsDataService> logger)
{
    private string Root => Path.GetFullPath(configuration["Mls:DataPath"] ?? "Data/processed/mls/seasons", environment.ContentRootPath);
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

    public int[] Seasons()
    {
        try
        {
            return Directory.Exists(Root) ? Directory.GetFiles(Root, "*.json")
                .Select(Path.GetFileNameWithoutExtension).Where(s => Regex.IsMatch(s ?? "", @"^[1-9]\d{3}$"))
                .Select(s => int.Parse(s!, CultureInfo.InvariantCulture)).OrderDescending().ToArray() : [];
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            logger.LogError(error, "Unable to discover MLS seasons");
            throw new MlsDataException(503, "MLS data is unavailable. Please try again later.");
        }
    }

    // Read each request: atomic file replacements and new seasons need no process restart.
    public async Task<MlsSeason> Get(int? requested, CancellationToken ct = default)
    {
        if (requested is < 1000 or > 9999) throw new MlsDataException(400, "Use a four-digit season.");
        var years = Seasons();
        if (years.Length == 0) throw new MlsDataException(503, "MLS data has not been imported yet.");
        var year = requested ?? years[0];
        if (!years.Contains(year)) throw new MlsDataException(404, "MLS season is not imported.");
        try
        {
            await using var stream = File.OpenRead(Path.Combine(Root, $"{year}.json"));
            var data = await JsonSerializer.DeserializeAsync<MlsSeason>(stream, Options, ct) ?? throw new JsonException("Empty season");
            Validate(data, year);
            return data;
        }
        catch (Exception error) when (error is IOException or JsonException or UnauthorizedAccessException or ArgumentException or NullReferenceException or InvalidOperationException)
        {
            logger.LogError(error, "Unable to read MLS season {Season}", year);
            throw new MlsDataException(503, "MLS data is unavailable or invalid. Check the import and backend logs.");
        }
    }

    public static void Validate(MlsSeason data, int year)
    {
        if (data.Season != year || data.Teams is null || data.Players is null || data.Games is null || data.TeamStats is null || data.PlayerStats is null || data.GameTeamStats is null || data.GamePlayerStats is null)
            throw new JsonException("Invalid MLS envelope");
        static bool Id(string? id) => !string.IsNullOrWhiteSpace(id) && id.Length <= 200 && !id.Any(char.IsControl);
        if (data.Teams.Any(t => t is null || !Id(t.Id) || string.IsNullOrWhiteSpace(t.Name)) ||
            data.Players.Any(p => p is null || !Id(p.Id) || string.IsNullOrWhiteSpace(p.Name) || p.ObservedTeamIds is null) ||
            data.Games.Any(g => g is null || !Id(g.Id)) ||
            data.Teams.Select(t => t.Id).Distinct().Count() != data.Teams.Length ||
            data.Players.Select(p => p.Id).Distinct().Count() != data.Players.Length ||
            data.Games.Select(g => g.Id).Distinct().Count() != data.Games.Length)
            throw new JsonException("Invalid or duplicate MLS identities");
        var teams = data.Teams.Select(t => t.Id).ToHashSet();
        var players = data.Players.Select(p => p.Id).ToHashSet();
        if (data.Players.Any(p => p.TeamId is not null && !teams.Contains(p.TeamId) || p.ObservedTeamIds.Any(t => !teams.Contains(t))))
            throw new JsonException("Invalid MLS player team references");
        foreach (var game in data.Games)
        {
            if (!teams.Contains(game.HomeTeamId) || !teams.Contains(game.AwayTeamId) || game.HomeTeamId == game.AwayTeamId ||
                game.HomeScore < 0 || game.AwayScore < 0 || string.IsNullOrWhiteSpace(game.SeasonType))
                throw new JsonException("Invalid MLS match");
            if (game.ShootoutWinnerTeamId is not null &&
                (!game.Shootout || !game.HomeScore.HasValue || game.HomeScore != game.AwayScore ||
                 game.ShootoutWinnerTeamId != game.HomeTeamId && game.ShootoutWinnerTeamId != game.AwayTeamId))
                throw new JsonException("Invalid MLS shootout winner");
            if (game.ShootoutWinPoints is not null &&
                (year is < 1996 or > 1999 || game.ShootoutWinPoints != 1 || !game.Shootout || game.ShootoutWinnerTeamId is null))
                throw new JsonException("Invalid historical MLS shootout points");
            // Existing imports use both YYYY-MM-DD and ISO timestamps.
            if (DateOnly.TryParseExact(game.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) continue;
            if (game.Date is null || !game.Date.Contains('T') || !DateTimeOffset.TryParse(game.Date, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date))
                throw new JsonException("Invalid MLS match date");
            game.StartTime ??= game.Date;
            game.Date = date.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        void Stats(MlsStat[] rows, HashSet<string> ids)
        {
            if (rows.Any(s => s is null || !ids.Contains(s.Id) || string.IsNullOrWhiteSpace(s.SeasonType) || s.Statistics is null ||
                    s.Statistics.Any(pair => string.IsNullOrWhiteSpace(pair.Key) || pair.Value is double n && !double.IsFinite(n))) ||
                rows.Select(s => (s.Id, s.SeasonType)).Distinct().Count() != rows.Length)
                throw new JsonException("Invalid MLS statistics");
        }
        Stats(data.TeamStats, teams);
        Stats(data.PlayerStats, players);
        var games = data.Games.ToDictionary(g => g.Id);
        void GameStats(MlsGameStat[] rows, bool player)
        {
            if (rows.Any(s => s is null || !games.TryGetValue(s.GameId, out var game) || !game.Completed ||
                s.TeamId != game.HomeTeamId && s.TeamId != game.AwayTeamId ||
                (player ? s.PlayerId is null || !players.Contains(s.PlayerId) : s.PlayerId is not null) ||
                s.Statistics is null || s.Statistics.Any(p => string.IsNullOrWhiteSpace(p.Key) || p.Value is double n && !double.IsFinite(n))) ||
                rows.Select(s => (s.GameId, s.TeamId, s.PlayerId)).Distinct().Count() != rows.Length)
                throw new JsonException("Invalid MLS match statistics");
        }
        GameStats(data.GameTeamStats, false);
        GameStats(data.GamePlayerStats, true);
    }
}

