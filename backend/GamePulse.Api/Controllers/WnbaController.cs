using System.Globalization;
using GamePulse.Api.Models.Wnba;
using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GamePulse.Api.Controllers;

public sealed class WnbaExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not WnbaDataException error) return;
        context.Result = new ObjectResult(new { message = error.Message }) { StatusCode = error.StatusCode };
        context.ExceptionHandled = true;
    }
}

[ApiController]
[Route("api/leagues/wnba")]
[TypeFilter(typeof(WnbaExceptionFilter))]
public sealed class WnbaController(WnbaJsonDataService service) : ControllerBase
{
    [HttpGet("seasons")]
    public async Task<IActionResult> Seasons(CancellationToken ct)
        => Ok((await service.GetSeasonsAsync(ct)).Select(y => y.ToString(CultureInfo.InvariantCulture)));

    [HttpGet("coverage")]
    public async Task<IActionResult> Coverage([FromQuery] int? season, CancellationToken ct)
        => Ok((await service.GetSeasonAsync(season, ct)).Coverage);

    [HttpGet("standings")]
    public async Task<IActionResult> Standings([FromQuery] int? season, CancellationToken ct)
        => Ok(WnbaSeasonCalculator.Standings(await service.GetSeasonAsync(season, ct)));

    [HttpGet("team-stats")]
    public async Task<IActionResult> TeamStatistics([FromQuery] int? season, [FromQuery] string? seasonType, CancellationToken ct)
        => Ok(WnbaSeasonCalculator.TeamStatistics(await service.GetSeasonAsync(season, ct), seasonType));

    [HttpGet("team-stats/{id}")]
    public async Task<IActionResult> TeamStatisticsById(string id, [FromQuery] int? season,
        [FromQuery] string? seasonType, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        var team = FindTeam(data, id);
        return Ok(WnbaSeasonCalculator.TeamStatistics(data, seasonType).Teams.Single(t => t.TeamId == team.Id));
    }

    [HttpGet("teams")]
    public async Task<IActionResult> Teams([FromQuery] int? season, CancellationToken ct)
        => Ok((await service.GetSeasonAsync(season, ct)).Teams.OrderBy(t => t.Name));

    [HttpGet("teams/{id}")]
    public async Task<IActionResult> Team(string id, [FromQuery] int? season, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        var team = FindTeam(data, id);
        return Ok(team);
    }

    [HttpGet("players")]
    public async Task<IActionResult> Players([FromQuery] int? season, [FromQuery] string? teamId,
        [FromQuery] string? search, [FromQuery] bool includeRoster = true, CancellationToken ct = default)
    {
        var data = await service.GetSeasonAsync(season, ct);
        IEnumerable<WnbaPlayer> players = data.Players;
        if (!string.IsNullOrWhiteSpace(teamId))
        {
            var team = FindTeam(data, teamId);
            players = players.Where(p => p.TeamIds.Contains(team.Id) || (includeRoster && p.RosterSnapshotTeamIds.Contains(team.Id)));
        }
        if (!string.IsNullOrWhiteSpace(search))
            players = players.Where(p => p.FullName?.Contains(search, StringComparison.OrdinalIgnoreCase) == true);
        return Ok(players.OrderBy(p => p.FullName));
    }

    [HttpGet("players/{id}")]
    public async Task<IActionResult> Player(string id, [FromQuery] int? season, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        return Ok(FindPlayer(data, id));
    }

    [HttpGet("games")]
    public async Task<IActionResult> Games([FromQuery] int? season, [FromQuery] string? seasonType,
        [FromQuery] string? teamId, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        IEnumerable<WnbaGame> games = data.Games;
        if (!string.IsNullOrWhiteSpace(teamId))
        {
            var team = FindTeam(data, teamId);
            games = games.Where(g => g.HomeTeamId == team.Id || g.AwayTeamId == team.Id);
        }
        return Ok(FilterSeasonType(games, seasonType).OrderByDescending(g => g.GameDate).ThenBy(g => g.Id));
    }

    [HttpGet("games/{gameId}")]
    public async Task<IActionResult> Game(string gameId, [FromQuery] int? season, CancellationToken ct)
        => Ok(FindGame(await service.GetSeasonAsync(season, ct), gameId));

    [HttpGet("games/{gameId}/statistics")]
    public async Task<IActionResult> Statistics(string gameId, [FromQuery] int? season, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        var game = FindGame(data, gameId);
        var teams = data.Teams.ToDictionary(t => t.Id);
        var players = data.Players.ToDictionary(p => p.Id);
        var teamStats = data.TeamStatistics.Where(s => s.GameId == game.Id).ToArray();
        var playerStats = data.PlayerStatistics.Where(s => s.GameId == game.Id).ToArray();
        return Ok(new
        {
            game, coverage = game.Coverage,
            hasTeamStatistics = teamStats.Length > 0, hasPlayerStatistics = playerStats.Length > 0,
            teamStatistics = teamStats.Select(s => new { s.GameId, s.TeamId, teamName = teams[s.TeamId].Name,
                s.Season, s.SeasonType, s.Statistics, s.Sources, s.StatSources }),
            playerStatistics = playerStats.Select(s => new { s.GameId, s.TeamId, s.PlayerId,
                playerName = players[s.PlayerId!].FullName, teamName = teams[s.TeamId].Name,
                s.Season, s.SeasonType, s.Statistics, s.Sources, s.StatSources })
        });
    }

    [HttpGet("teams/{id}/games")]
    public async Task<IActionResult> TeamGames(string id, [FromQuery] int? season, [FromQuery] string? seasonType, CancellationToken ct)
        => await Games(season, seasonType, id, ct);

    [HttpGet("teams/{id}/players")]
    public async Task<IActionResult> TeamPlayers(string id, [FromQuery] int? season,
        [FromQuery] bool includeRoster = true, CancellationToken ct = default)
        => await Players(season, id, null, includeRoster, ct);

    [HttpGet("players/{id}/games")]
    public async Task<IActionResult> PlayerGames(string id, [FromQuery] int? season, [FromQuery] string? seasonType, CancellationToken ct)
    {
        var data = await service.GetSeasonAsync(season, ct);
        var player = FindPlayer(data, id);
        var gameIds = data.PlayerStatistics.Where(s => s.PlayerId == player.Id).Select(s => s.GameId).ToHashSet();
        return Ok(FilterSeasonType(data.Games.Where(g => gameIds.Contains(g.Id)), seasonType)
            .OrderByDescending(g => g.GameDate).Select(g => new
            {
                game = g,
                statistics = data.PlayerStatistics.Where(s => s.PlayerId == player.Id && s.GameId == g.Id)
            }));
    }

    private static IEnumerable<WnbaGame> FilterSeasonType(IEnumerable<WnbaGame> games, string? seasonType)
    {
        if (string.IsNullOrWhiteSpace(seasonType)) return games;
        var normalized = seasonType.Trim().ToLowerInvariant() switch
        {
            "2" or "regular" or "regular-season" or "regular season" => "Regular Season",
            "3" or "playoffs" or "postseason" or "post-season" => "Playoffs",
            "1" or "preseason" or "pre-season" => "Preseason",
            "4" or "offseason" or "off-season" => "Offseason",
            _ => throw new WnbaDataException(400, "seasonType must be Regular Season, Playoffs, Preseason, or Offseason.")
        };
        return games.Where(g => string.Equals(g.SeasonType, normalized, StringComparison.OrdinalIgnoreCase));
    }

    private static WnbaTeam FindTeam(WnbaSeasonData data, string id)
        => data.Teams.FirstOrDefault(t => WnbaJsonDataService.SameId(t.Id, t.ExternalTeamId, id))
            ?? throw new WnbaDataException(404, $"WNBA team '{id}' was not found in {data.Season}.");
    private static WnbaPlayer FindPlayer(WnbaSeasonData data, string id)
        => data.Players.FirstOrDefault(p => WnbaJsonDataService.SameId(p.Id, p.ExternalPlayerId, id))
            ?? throw new WnbaDataException(404, $"WNBA player '{id}' was not found in {data.Season}.");
    private static WnbaGame FindGame(WnbaSeasonData data, string id)
        => data.Games.FirstOrDefault(g => WnbaJsonDataService.SameId(g.Id, g.ExternalGameId, id))
            ?? throw new WnbaDataException(404, $"WNBA game '{id}' was not found in {data.Season}.");
}
