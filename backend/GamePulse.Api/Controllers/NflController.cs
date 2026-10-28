using GamePulse.Api.Models.Nfl;
using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GamePulse.Api.Controllers;

public sealed class NflExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not NflDataException error) return;
        context.Result = new ObjectResult(new { message = error.Message }) { StatusCode = error.StatusCode };
        context.ExceptionHandled = true;
    }
}

[ApiController, Route("api/leagues/nfl"), TypeFilter(typeof(NflExceptionFilter))]
public sealed class NflController(NflDataService service) : ControllerBase
{
    [HttpGet("leaderboards")]
    public async Task<IActionResult> Leaders(int? season, string group = "passing", string seasonType = "REG", string? metric = null,
        string? teamId = null, string? position = null, string? search = null, int minOpportunities = 0,
        int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        var s = await service.Season(season, ct);
        var team = string.IsNullOrEmpty(teamId) ? null : (await Team(s, teamId, ct)).TeamId;
        metric ??= group switch { "passing" => "passing_yards", "rushing" => "rushing_yards", "receiving" => "receiving_yards", _ => "" };
        var phase = seasonType.ToUpperInvariant();
        var rows = await service.Read<NflStat>(s, "player_stats", ct);
        var games = await service.Read<NflGame>(s, "games", ct);
        var players = await service.Read<NflPlayer>(s, "players", ct);
        var ranked = NflLeaderboards.Calculate(rows, games, players, group, phase, metric, team, position, minOpportunities);
        var selected = string.IsNullOrWhiteSpace(search) ? ranked : ranked.Where(r => r.Name.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase)).ToArray();
        return Ok(new { season = s.Manifest.Season, group, seasonType = phase, metric, minOpportunities,
            opportunity = NflLeaderboards.Definitions[group].Opportunity, sortDirection = "descending", rankedTotal = ranked.Count(r => r.Rank.HasValue),
            generatedAtUtc = s.Manifest.GeneratedAtUtc, coverage = s.Manifest.Coverage,
            method = "Observed player weekly statistics from scored final games only. Regular season and postseason are separate. Any missing contributing field makes its total and dependent rates unavailable. Rates use component totals. Team filters select only that team's contributions; traded players retain separate team splits. Minimum opportunities are custom filters, not official NFL qualification. Search preserves ranks. Counts and rates sort descending; equal values share competition rank. Roster listings and absent rows do not establish complete player coverage.",
            results = Page(selected, page, pageSize) });
    }
    private static string? Phase(string? phase)
    {
        if (string.IsNullOrEmpty(phase)) return null;
        var p = phase.ToUpperInvariant();
        return p is "REG" or "POST" or "PRE" ? p : throw new NflDataException(400, "seasonType must be REG, POST, or PRE.");
    }
    private static void Week(int? week)
    {
        if (week is < 1 or > 30) throw new NflDataException(400, "week must be between 1 and 30.");
    }
    private static NflPage<T> Page<T>(IEnumerable<T> rows, int page, int pageSize)
    {
        if (page < 1 || page > 1000000 || pageSize < 1 || pageSize > 100)
            throw new NflDataException(400, "Use page 1–1000000 and pageSize 1–100.");
        var all = rows.ToArray();
        return new(all.Skip((page - 1) * pageSize).Take(pageSize).ToArray(), all.Length, page, pageSize);
    }
    private async Task<NflTeam> Team(NflSnapshot s, string id, CancellationToken ct) =>
        (await service.Read<NflTeam>(s, "teams", ct)).SingleOrDefault(t => t.TeamId.Equals(id, StringComparison.OrdinalIgnoreCase))
        ?? throw new NflDataException(404, "NFL team not found in this season.");
    private static IEnumerable<NflGame> Games(IEnumerable<NflGame> rows, string? teamId, string? phase, int? week, string? status)
    {
        var p = Phase(phase); Week(week);
        if (p is not null) rows = rows.Where(g => g.SeasonType == p);
        if (week.HasValue) rows = rows.Where(g => g.Week == week);
        if (!string.IsNullOrEmpty(teamId)) rows = rows.Where(g => g.HomeTeamId == teamId || g.AwayTeamId == teamId);
        if (!string.IsNullOrEmpty(status)) rows = status switch
        {
            "final" => rows.Where(g => g.Status == "final"),
            "scheduled" => rows.Where(g => g.Status == "scheduled"),
            _ => throw new NflDataException(400, "status must be final or scheduled.")
        };
        return rows.OrderBy(g => g.Date, StringComparer.Ordinal).ThenBy(g => g.KickoffUtc).ThenBy(g => g.GameId, StringComparer.Ordinal);
    }
    private static IEnumerable<NflStat> Stats(IEnumerable<NflStat> rows, string? teamId, string? phase, int? week)
    {
        var p = Phase(phase); Week(week);
        return rows.Where(r => (teamId is null || r.TeamId == teamId) && (p is null || r.SeasonType == p) && (!week.HasValue || r.Week == week))
            .OrderBy(r => r.SeasonType == "REG" ? 0 : r.SeasonType == "POST" ? 1 : 2).ThenBy(r => r.Week).ThenBy(r => r.TeamId).ThenBy(r => r.PlayerId);
    }

    [HttpGet("seasons")]
    public async Task<IActionResult> Seasons(CancellationToken ct) => Ok((await service.Seasons(ct)).Select(m => new { m.Season, m.GeneratedAtUtc, m.Coverage }));

    [HttpGet("coverage")]
    public async Task<IActionResult> Coverage(int? season, CancellationToken ct)
    {
        var s = await service.Season(season, ct);
        var games = await service.Read<NflGame>(s, "games", ct);
        return Ok(new { season = s.Manifest.Season, s.Manifest.RunId, s.Manifest.GeneratedAtUtc, s.Manifest.Coverage,
            phases = games.GroupBy(g => g.SeasonType).Select(g => new { seasonType = g.Key, weeks = g.Select(x => x.Week).Distinct().Order().ToArray() }),
            method = "Historical batch snapshot from nflverse. Final status is inferred from scores; this is not a live scoreboard. Current team branding may differ from historical branding." });
    }

    [HttpGet("teams")]
    public async Task<IActionResult> Teams(int? season, CancellationToken ct)
    {
        var s = await service.Season(season, ct);
        return Ok((await service.Read<NflTeam>(s, "teams", ct)).OrderBy(t => t.Name));
    }
    [HttpGet("teams/{id}")]
    public async Task<IActionResult> TeamById(string id, int? season, string? seasonType, CancellationToken ct)
    {
        var phase = Phase(seasonType);
        var s = await service.Season(season, ct); var team = await Team(s, id, ct);
        return Ok(new { season = s.Manifest.Season, team,
            records = (await service.Read<NflRecord>(s, "records", ct)).Where(r => r.TeamId == team.TeamId && (phase is null || r.SeasonType == phase)),
            games = Games(await service.Read<NflGame>(s, "games", ct), team.TeamId, phase, null, null),
            rosters = (await service.Read<NflRoster>(s, "rosters", ct)).Where(r => r.TeamId == team.TeamId).OrderBy(r => r.Name),
            statistics = Stats(await service.Read<NflStat>(s, "team_stats", ct), team.TeamId, phase, null) });
    }
    [HttpGet("players")]
    public async Task<IActionResult> Players(int? season, string? teamId, string? search, string? position, int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        var s = await service.Season(season, ct); IEnumerable<NflPlayer> rows = await service.Read<NflPlayer>(s, "players", ct);
        if (!string.IsNullOrEmpty(teamId)) { var t = await Team(s, teamId, ct); rows = rows.Where(p => p.TeamIds.Contains(t.TeamId)); }
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(p => p.Name?.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) == true);
        if (!string.IsNullOrWhiteSpace(position)) rows = rows.Where(p => string.Equals(p.Position, position, StringComparison.OrdinalIgnoreCase));
        return Ok(Page(rows.OrderBy(p => p.Name).ThenBy(p => p.PlayerId), page, pageSize));
    }
    [HttpGet("players/{id}")]
    public async Task<IActionResult> PlayerById(string id, int? season, string? seasonType, CancellationToken ct)
    {
        var phase = Phase(seasonType); var s = await service.Season(season, ct);
        var player = (await service.Read<NflPlayer>(s, "players", ct)).SingleOrDefault(p => p.PlayerId == id)
            ?? throw new NflDataException(404, "NFL player not found in this season.");
        var rows = Stats((await service.Read<NflStat>(s, "player_stats", ct)).Where(r => r.PlayerId == id), null, phase, null).ToArray();
        var ids = rows.Select(r => r.GameId).ToHashSet();
        return Ok(new { season = s.Manifest.Season, player, statistics = rows,
            games = Games((await service.Read<NflGame>(s, "games", ct)).Where(g => ids.Contains(g.GameId)), null, phase, null, null),
            rosters = (await service.Read<NflRoster>(s, "rosters", ct)).Where(r => r.PlayerId == id) });
    }
    [HttpGet("games")]
    public async Task<IActionResult> GameList(int? season, string? teamId, string? seasonType, int? week, string? status, string order = "asc", int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        var s = await service.Season(season, ct);
        var team = string.IsNullOrEmpty(teamId) ? null : (await Team(s, teamId, ct)).TeamId;
        if (order is not ("asc" or "desc")) throw new NflDataException(400, "order must be asc or desc.");
        var games = Games(await service.Read<NflGame>(s, "games", ct), team, seasonType, week, status);
        return Ok(Page(order == "desc" ? games.Reverse() : games, page, pageSize));
    }
    [HttpGet("games/{id}")]
    public async Task<IActionResult> GameById(string id, int? season, CancellationToken ct)
    {
        var s = await service.Season(season, ct);
        var game = (await service.Read<NflGame>(s, "games", ct)).SingleOrDefault(g => g.GameId == id)
            ?? throw new NflDataException(404, "NFL game not found in this season.");
        return Ok(new { season = s.Manifest.Season, game,
            teamStatistics = (await service.Read<NflStat>(s, "team_stats", ct)).Where(r => r.GameId == id),
            playerStatistics = (await service.Read<NflStat>(s, "player_stats", ct)).Where(r => r.GameId == id) });
    }
    [HttpGet("standings")]
    public async Task<IActionResult> Standings(int? season, string seasonType = "REG", CancellationToken ct = default)
    {
        var phase = Phase(seasonType) ?? "REG"; var s = await service.Season(season, ct);
        var records = await service.Read<NflRecord>(s, "records", ct);
        var teams = await service.Read<NflTeam>(s, "teams", ct);
        return Ok(new { season = s.Manifest.Season, seasonType = phase,
            method = "Calculated from scored games. PCT = (wins + ties / 2) / played. Regular season and postseason stay separate. No official NFL tiebreakers, rankings, seeding, or playoff qualification are applied.",
            teams = teams.Select(t => { var r = records.SingleOrDefault(r => r.TeamId == t.TeamId && r.SeasonType == phase); return new { team = t, record = r, winPercentage = r is { Played: > 0 } ? (double?)(r.Wins + r.Ties / 2.0) / r.Played : null }; })
                .OrderBy(r => r.team.Division).ThenByDescending(r => r.winPercentage).ThenBy(r => r.team.Name) });
    }
    [HttpGet("statistics")]
    public async Task<IActionResult> Statistics(int? season, string kind = "player", string? seasonType = null, int? week = null, string? teamId = null, string? search = null, string? statGroup = null, int page = 1, int pageSize = 40, CancellationToken ct = default)
    {
        if (kind is not ("player" or "team")) throw new NflDataException(400, "kind must be player or team.");
        var s = await service.Season(season, ct);
        var team = string.IsNullOrEmpty(teamId) ? null : (await Team(s, teamId, ct)).TeamId;
        var rows = Stats(await service.Read<NflStat>(s, kind == "player" ? "player_stats" : "team_stats", ct), team, seasonType, week);
        if (!string.IsNullOrEmpty(statGroup))
        {
            string[] keys = statGroup switch
            {
                "passing" => ["completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered"],
                "rushing" => ["carries", "rushing_yards", "rushing_tds", "rushing_first_downs", "rushing_fumbles", "rushing_fumbles_lost"],
                "receiving" => ["targets", "receptions", "receiving_yards", "receiving_tds", "receiving_yards_after_catch", "receiving_fumbles_lost"],
                "defense" => ["def_tackles_solo", "def_tackle_assists", "def_tackles_for_loss", "def_sacks", "def_interceptions", "def_fumbles_forced"],
                "kicking" => ["fg_made", "fg_att", "fg_long", "pat_made", "pat_att", "pt_yards"],
                _ => throw new NflDataException(400, "Unknown statistic category.")
            };
            rows = rows.Where(r => keys.Any(k => r.Stats.TryGetProperty(k, out var v) && v.ValueKind == System.Text.Json.JsonValueKind.Number && v.TryGetDouble(out var n) && n != 0));
        }
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(r => r.Name?.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) == true || r.TeamId.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase));
        return Ok(Page(rows, page, pageSize));
    }
}
