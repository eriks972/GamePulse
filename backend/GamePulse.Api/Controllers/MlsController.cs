using System.Globalization;
using GamePulse.Api.Models.Mls;
using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GamePulse.Api.Controllers;

public sealed class MlsExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not MlsDataException error) return;
        context.Result = new ObjectResult(new { message = error.Message }) { StatusCode = error.Status };
        context.ExceptionHandled = true;
    }
}

[ApiController, Route("api/leagues/mls"), TypeFilter(typeof(MlsExceptionFilter))]
public sealed class MlsController(MlsDataService service) : ControllerBase
{
    private static MlsTeam Team(MlsSeason data, string id) => data.Teams.SingleOrDefault(t => t.Id == id)
        ?? throw new MlsDataException(404, "MLS team not found in this season.");
    private static MlsPlayer Player(MlsSeason data, string id) => data.Players.SingleOrDefault(p => p.Id == id)
        ?? throw new MlsDataException(404, "MLS player not found in this season.");
    private static MlsGame Game(MlsSeason data, string id) => data.Games.SingleOrDefault(g => g.Id == id)
        ?? throw new MlsDataException(404, "MLS match not found in this season.");
    private static object Page<T>(IEnumerable<T> source, int page, int pageSize)
    {
        if (page is < 1 or > 1000000 || pageSize is < 1 or > 100)
            throw new MlsDataException(400, "Use page >= 1 and pageSize between 1 and 100.");
        var rows = source.ToArray();
        return new { items = rows.Skip((page - 1) * pageSize).Take(pageSize).ToArray(), total = rows.Length, page, pageSize };
    }
    private static IEnumerable<MlsGame> Matches(MlsSeason data, string phase, string? teamId = null) => data.Games
        .Where(g => g.SeasonType == MlsInsights.Phase(phase) && (teamId == null || g.HomeTeamId == teamId || g.AwayTeamId == teamId))
        .OrderByDescending(g => g.Date).ThenBy(g => g.Id, StringComparer.Ordinal);

    // Preserve the aggregate endpoint consumed by the existing MLS pages.
    [HttpGet("season")]
    public async Task<IActionResult> Season(int? season, CancellationToken ct)
    {
        try { return Ok(new { seasons = service.Seasons(), data = await service.Get(season, ct) }); }
        catch (MlsDataException error) when (error.Status == 404 || error.Status == 503 && service.Seasons().Length == 0)
        { return Ok(new { seasons = service.Seasons(), data = (MlsSeason?)null, message = error.Message }); }
    }
    [HttpGet("seasons")]
    public IActionResult Seasons() => Ok(service.Seasons().Select(s => s.ToString(CultureInfo.InvariantCulture)));
    [HttpGet("coverage")]
    public async Task<IActionResult> Coverage(int? season, CancellationToken ct) => Ok(MlsInsights.Coverage(await service.Get(season, ct)));
    [HttpGet("teams")]
    public async Task<IActionResult> Teams(int? season, string? search, string? conference, CancellationToken ct)
    {
        var data = await service.Get(season, ct);
        return Ok(data.Teams.Where(t => (string.IsNullOrWhiteSpace(search) || t.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase)) &&
            (string.IsNullOrEmpty(conference) || string.Equals(t.Conference, conference, StringComparison.OrdinalIgnoreCase))).OrderBy(t => t.Name).ThenBy(t => t.Id));
    }
    [HttpGet("teams/{id}")]
    public async Task<IActionResult> TeamById(string id, int? season, string seasonType = "Regular Season", CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        var data = await service.Get(season, ct); var team = Team(data, id);
        return Ok(new { season = data.Season, seasonType, analytics = MlsInsights.TeamProfile(data, team, seasonType),
            roster = data.Players.Where(p => p.TeamId == id), coverage = MlsInsights.Coverage(data), method = MlsInsights.Method });
    }
    [HttpGet("players")]
    public async Task<IActionResult> Players(int? season, string? search, string? teamId, string? position, int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        var data = await service.Get(season, ct);
        if (!string.IsNullOrEmpty(teamId)) Team(data, teamId);
        return Ok(Page(data.Players.Where(p => (string.IsNullOrWhiteSpace(search) || p.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase)) &&
            (string.IsNullOrEmpty(teamId) || p.TeamId == teamId || p.ObservedTeamIds.Contains(teamId)) &&
            (string.IsNullOrEmpty(position) || string.Equals(p.Position, position, StringComparison.OrdinalIgnoreCase))).OrderBy(p => p.Name).ThenBy(p => p.Id), page, pageSize));
    }
    [HttpGet("players/{id}")]
    public async Task<IActionResult> PlayerById(string id, int? season, string seasonType = "Regular Season", CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        var data = await service.Get(season, ct); var player = Player(data, id);
        return Ok(new { season = data.Season, seasonType, player, teams = data.Teams.Where(t => t.Id == player.TeamId || player.ObservedTeamIds.Contains(t.Id)),
            statistics = data.PlayerStats.SingleOrDefault(s => s.Id == id && s.SeasonType == seasonType), method = MlsInsights.Method });
    }
    [HttpGet("players/{id}/games")]
    public async Task<IActionResult> PlayerGames(string id, int? season, string seasonType = "Regular Season", int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        var data = await service.Get(season, ct); Player(data, id);
        var observations = data.GamePlayerStats.Where(s => s.PlayerId == id).ToArray();
        var ids = observations.Select(s => s.GameId).ToHashSet();
        return Ok(new { season = data.Season, seasonType,
            results = Page(Matches(data, seasonType).Where(g => ids.Contains(g.Id)).Select(g => new { game = g, statistics = observations.Where(s => s.GameId == g.Id) }), page, pageSize),
            method = "Only imported player match observations are included. Roster membership does not imply an appearance." });
    }
    [HttpGet("games")]
    public async Task<IActionResult> Games(int? season, string? teamId, string? date, string? status, string seasonType = "Regular Season", int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        if (date != null && !DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) throw new MlsDataException(400, "Use date YYYY-MM-DD.");
        if (status != null && status is not ("completed" or "scheduled" or "not-final")) throw new MlsDataException(400, "Use status completed, scheduled, or not-final.");
        var data = await service.Get(season, ct);
        if (!string.IsNullOrEmpty(teamId)) Team(data, teamId);
        return Ok(Page(Matches(data, seasonType, teamId).Where(g => (date == null || g.Date == date) && (status == null || g.Completed == (status == "completed"))), page, pageSize));
    }
    [HttpGet("games/{id}")]
    public async Task<IActionResult> GameById(string id, int? season, CancellationToken ct)
    { var data = await service.Get(season, ct); return Ok(Game(data, id)); }
    [HttpGet("games/{id}/statistics")]
    public async Task<IActionResult> GameStatistics(string id, int? season, CancellationToken ct)
    {
        var data = await service.Get(season, ct); var game = Game(data, id);
        var teamStatistics = data.GameTeamStats.Where(s => s.GameId == id).ToArray();
        var playerStatistics = data.GamePlayerStats.Where(s => s.GameId == id).ToArray();
        var available = teamStatistics.Length + playerStatistics.Length > 0;
        return Ok(new { game, available, teamStatistics, playerStatistics,
            message = available ? null : "Match statistics are unavailable. Imported season totals are not match statistics." });
    }
    [HttpGet("standings")]
    public async Task<IActionResult> Standings(int? season, CancellationToken ct)
    { var data = await service.Get(season, ct); return Ok(new { season = data.Season, teams = MlsInsights.Standings(data), coverage = MlsInsights.Coverage(data), method = MlsInsights.Method }); }
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(int? season, string seasonType = "Regular Season", CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType); var data = await service.Get(season, ct);
        return Ok(new { season = data.Season, seasonType, teams = data.Teams.OrderBy(t => t.Name).Select(t => MlsInsights.TeamProfile(data, t, seasonType)),
            coverage = MlsInsights.Coverage(data), method = MlsInsights.Method });
    }
    [HttpGet("statistics")]
    public async Task<IActionResult> Statistics(int? season, string kind = "player", string seasonType = "Regular Season", string? teamId = null,
        string? search = null, string metric = "goals", string sort = "desc", int minGames = 0, int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        if (kind is not ("team" or "player") || sort is not ("asc" or "desc") || minGames is < 0 or > 1000000 || string.IsNullOrWhiteSpace(metric))
            throw new MlsDataException(400, "Use kind player/team, sort asc/desc, a metric, and minGames 0–1000000.");
        var data = await service.Get(season, ct);
        if (!string.IsNullOrEmpty(teamId)) Team(data, teamId);
        var source = (kind == "team" ? data.TeamStats : data.PlayerStats).Where(s => s.SeasonType == seasonType).ToArray();
        if (source.Length > 0 && !source.Any(s => s.Statistics.ContainsKey(metric))) throw new MlsDataException(400, "Unknown MLS metric for this data.");
        var names = kind == "team" ? data.Teams.ToDictionary(t => t.Id, t => t.Name) : data.Players.ToDictionary(p => p.Id, p => p.Name);
        // A player's season total cannot be attributed to one club after a transfer.
        if (kind == "player" && teamId != null) throw new MlsDataException(400, "Player totals are season-wide; team-specific player statistics are unavailable.");
        var rows = source.Where(s => (teamId == null || s.Id == teamId) &&
            (minGames == 0 || s.Statistics.GetValueOrDefault("games") >= minGames));
        var ordered = (sort == "asc" ? rows.OrderBy(s => s.Statistics.GetValueOrDefault(metric) == null).ThenBy(s => s.Statistics.GetValueOrDefault(metric)) :
            rows.OrderBy(s => s.Statistics.GetValueOrDefault(metric) == null).ThenByDescending(s => s.Statistics.GetValueOrDefault(metric)))
            .ThenBy(s => names[s.Id], StringComparer.Ordinal).ThenBy(s => s.Id, StringComparer.Ordinal).ToArray();
        int? lastRank = null; double? lastValue = null;
        var ranked = ordered.Select((s, index) =>
        {
            var number = s.Statistics.GetValueOrDefault(metric);
            int? rank = number.HasValue ? lastValue.HasValue && number == lastValue ? lastRank : index + 1 : null;
            lastValue = number; lastRank = rank;
            return new { rank, id = s.Id, name = names[s.Id], statistics = s.Statistics };
        }).ToArray();
        return Ok(new { season = data.Season, seasonType, kind, metric, sort, results = Page(ranked.Where(s => string.IsNullOrWhiteSpace(search) || s.name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase)), page, pageSize), method = MlsInsights.Method });
    }
    [HttpGet("compare")]
    public async Task<IActionResult> Compare(string leftId, string rightId, int? leftSeason, int? rightSeason, string kind = "player", string seasonType = "Regular Season", CancellationToken ct = default)
    {
        MlsInsights.Phase(seasonType);
        if (kind is not ("team" or "player")) throw new MlsDataException(400, "Use kind player or team.");
        var left = await service.Get(leftSeason, ct); var right = await service.Get(rightSeason, ct);
        object Profile(MlsSeason d, string id) => kind == "team" ? new { season = d.Season, profile = MlsInsights.TeamProfile(d, Team(d, id), seasonType) } :
            new { season = d.Season, player = Player(d, id), statistics = d.PlayerStats.SingleOrDefault(s => s.Id == id && s.SeasonType == seasonType) };
        var ls = (kind == "team" ? left.TeamStats : left.PlayerStats).SingleOrDefault(s => s.Id == leftId && s.SeasonType == seasonType);
        var rs = (kind == "team" ? right.TeamStats : right.PlayerStats).SingleOrDefault(s => s.Id == rightId && s.SeasonType == seasonType);
        var keys = (ls?.Statistics.Keys.AsEnumerable() ?? []).Union(rs?.Statistics.Keys.AsEnumerable() ?? []);
        return Ok(new { kind, seasonType, left = Profile(left, leftId), right = Profile(right, rightId),
            differences = keys.ToDictionary(key => key, key => ls?.Statistics.GetValueOrDefault(key) - rs?.Statistics.GetValueOrDefault(key)), method = MlsInsights.Method });
    }
}
