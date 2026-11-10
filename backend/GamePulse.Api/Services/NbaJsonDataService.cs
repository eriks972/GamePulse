using System.Text.Json;
using GamePulse.Api.Models;

namespace GamePulse.Api.Services;

public class NbaJsonDataService
{
    private readonly string _processedDataPath;
    private readonly JsonSerializerOptions _jsonOptions;

    public NbaJsonDataService(IHostEnvironment environment)
    {
        _processedDataPath = Path.Combine(
            environment.ContentRootPath,
            "Data",
            "processed"
        );

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<List<Team>> GetTeamsAsync()
    {
        var path = Path.Combine(_processedDataPath, "teams.json");

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find teams.json at {path}");
        }

        await using var stream = File.OpenRead(path);

        return await JsonSerializer.DeserializeAsync<List<Team>>(stream, _jsonOptions) ?? [];
    }

    public async Task<List<Player>> GetPlayersAsync(int? teamId = null)
    {
        var path = Path.Combine(_processedDataPath, "players.json");

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find players.json at {path}");
        }

        await using var stream = File.OpenRead(path);

        var players = await JsonSerializer.DeserializeAsync<List<Player>>(stream, _jsonOptions) ?? [];

        if (teamId.HasValue)
        {
            players = players
                .Where(player => player.ExternalTeamId == teamId.Value)
                .ToList();
        }

        return players
            .OrderBy(player => player.FullName)
            .ToList();
    }

    public async Task<Player?> GetPlayerByIdAsync(int id)
    {
        var players = await GetPlayersAsync();

        return players.FirstOrDefault(player => player.Id == id);
    }

    public async Task<List<Game>> GetGamesAsync(
    string? season = null,
    string? seasonType = "Regular Season"
)
{
    var selectedSeason = string.IsNullOrWhiteSpace(season)
        ? "2022"
        : season;

    var selectedSeasonType = string.IsNullOrWhiteSpace(seasonType)
        ? "Regular Season"
        : seasonType;

    var path = Path.Combine(
        _processedDataPath,
        "games_by_season",
        $"{selectedSeason}.json"
    );

    if (!File.Exists(path))
    {
        throw new FileNotFoundException($"Could not find games file at {path}");
    }

    await using var stream = File.OpenRead(path);

    var games = await JsonSerializer.DeserializeAsync<List<Game>>(
        stream,
        _jsonOptions
    );

    return (games ?? new List<Game>())
        .Where(game =>
            string.Equals(
                game.SeasonType,
                selectedSeasonType,
                StringComparison.OrdinalIgnoreCase
            )
        )
        .OrderByDescending(game => game.GameDate)
        .ToList();
}

public async Task<Game?> GetGameByIdAsync(string gameId)
{
    var gamesBySeasonPath = Path.Combine(_processedDataPath, "games_by_season");

    if (!Directory.Exists(gamesBySeasonPath))
    {
        throw new DirectoryNotFoundException(
            $"Could not find games_by_season folder at {gamesBySeasonPath}"
        );
    }

    var seasonFiles = Directory
        .GetFiles(gamesBySeasonPath, "*.json")
        .OrderByDescending(file => Path.GetFileNameWithoutExtension(file))
        .ToList();

    foreach (var seasonFile in seasonFiles)
    {

        await using var stream = File.OpenRead(seasonFile);

        using var document = await JsonDocument.ParseAsync(stream);

        foreach (var element in document.RootElement.EnumerateArray())
        {
            string? id = null;
            string? externalGameId = null;

            if (element.TryGetProperty("id", out var idProperty))
            {
                id = idProperty.ToString();
            }

            if (element.TryGetProperty("externalGameId", out var externalIdProperty))
            {
                externalGameId = externalIdProperty.ToString();
            }

            if (
                string.Equals(id, gameId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(externalGameId, gameId, StringComparison.OrdinalIgnoreCase)
            )
            {

                return element.Deserialize<Game>(_jsonOptions);
            }
        }
    }

    return null;
}
    public async Task<List<string>> GetSeasonsAsync()
    {
        var path = Path.Combine(_processedDataPath, "seasons.json");

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find seasons.json at {path}");
        }

        await using var stream = File.OpenRead(path);

        return await JsonSerializer.DeserializeAsync<List<string>>(stream, _jsonOptions) ?? [];
    }

    public async Task<Dictionary<string, List<Team>>> GetStandingsBySeasonAsync()
    {
        var path = Path.Combine(_processedDataPath, "standings_by_season.json");

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find standings_by_season.json at {path}");
        }

        await using var stream = File.OpenRead(path);

        return await JsonSerializer.DeserializeAsync<Dictionary<string, List<Team>>>(stream, _jsonOptions)
            ?? new Dictionary<string, List<Team>>();
    }

    public async Task<Dictionary<string, List<TeamStats>>> GetTeamStatsBySeasonAsync()
    {
        var path = Path.Combine(_processedDataPath, "team_stats_by_season.json");

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find team_stats_by_season.json at {path}");
        }

        await using var stream = File.OpenRead(path);

        return await JsonSerializer.DeserializeAsync<Dictionary<string, List<TeamStats>>>(stream, _jsonOptions)
            ?? new Dictionary<string, List<TeamStats>>();
    }

    public async Task<List<TeamStats>> GetTeamStatsAsync(string? season = null)
    {
        var seasons = await GetSeasonsAsync();
        var teamStatsBySeason = await GetTeamStatsBySeasonAsync();

        var selectedSeason = season;

        if (string.IsNullOrWhiteSpace(selectedSeason))
        {
            selectedSeason = seasons.FirstOrDefault();
        }

        if (selectedSeason is null || !teamStatsBySeason.ContainsKey(selectedSeason))
        {
            return [];
        }

        return teamStatsBySeason[selectedSeason]
            .OrderBy(team => team.Name)
            .ToList();
    }

    public async Task<TeamStats?> GetTeamStatsByTeamIdAsync(int teamId, string? season = null)
    {
        var teamStats = await GetTeamStatsAsync(season);

        return teamStats.FirstOrDefault(team => team.Id == teamId);
    }

    public async Task<List<Team>> GetStandingsAsync(string? season = null)
    {
        var seasons = await GetSeasonsAsync();
        var standingsBySeason = await GetStandingsBySeasonAsync();

        var selectedSeason = season;

        if (string.IsNullOrWhiteSpace(selectedSeason))
        {
            selectedSeason = seasons.FirstOrDefault();
        }

        if (selectedSeason is null || !standingsBySeason.ContainsKey(selectedSeason))
        {
            return [];
        }

        return standingsBySeason[selectedSeason]
            .OrderByDescending(team =>
            {
                var totalGames = team.Wins + team.Losses;
                return totalGames > 0 ? (double)team.Wins / totalGames : 0;
            })
            .ThenByDescending(team => team.Wins)
            .ToList();
    }

    public async Task<List<LineScore>> GetLineScoresAsync()
{
    var lineScoresBySeasonPath = Path.Combine(_processedDataPath, "line_scores_by_season");

    if (!Directory.Exists(lineScoresBySeasonPath))
    {
        throw new DirectoryNotFoundException(
            $"Could not find line_scores_by_season folder at {lineScoresBySeasonPath}"
        );
    }

    var seasonFiles = Directory
        .GetFiles(lineScoresBySeasonPath, "*.json")
        .OrderByDescending(file => Path.GetFileNameWithoutExtension(file))
        .ToList();

    var allLineScores = new List<LineScore>();

    foreach (var seasonFile in seasonFiles)
    {
        await using var stream = File.OpenRead(seasonFile);

        var seasonLineScores = await JsonSerializer.DeserializeAsync<List<LineScore>>(
            stream,
            _jsonOptions
        );

        if (seasonLineScores != null)
        {
            allLineScores.AddRange(seasonLineScores);
        }
    }

    return allLineScores;
}

public async Task<List<LineScore>> GetLineScoresByGameIdAsync(string gameId)
{
    var lineScoresBySeasonPath = Path.Combine(_processedDataPath, "line_scores_by_season");

    if (!Directory.Exists(lineScoresBySeasonPath))
    {
        return new List<LineScore>();
    }

    var seasonFiles = Directory
        .GetFiles(lineScoresBySeasonPath, "*.json")
        .OrderByDescending(file => Path.GetFileNameWithoutExtension(file))
        .ToList();

    foreach (var seasonFile in seasonFiles)
    {
        await using var stream = File.OpenRead(seasonFile);

        var lineScores = await JsonSerializer.DeserializeAsync<List<LineScore>>(
            stream,
            _jsonOptions
        );

        var gameLineScores = (lineScores ?? new List<LineScore>())
            .Where(score =>
                string.Equals(score.GameId, gameId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(score.ExternalGameId, gameId, StringComparison.OrdinalIgnoreCase)
            )
            .OrderBy(score => score.IsHome)
            .ToList();

        if (gameLineScores.Any())
        {
            return gameLineScores;
        }
    }

    return new List<LineScore>();
}
}
