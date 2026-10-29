using System.Globalization;
using GamePulse.Api.Models.Mlb;
using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
namespace GamePulse.Api.Controllers;
public sealed class MlbExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not MlbDataException error) return;
        context.Result=new ObjectResult(new { message=error.Message }) { StatusCode=error.StatusCode };context.ExceptionHandled=true;
    }
}
[ApiController, Route("api/leagues/mlb"), TypeFilter(typeof(MlbExceptionFilter))]
public sealed class MlbController(MlbJsonDataService service) : ControllerBase
{
    private static bool Match(string canonical,string source,string requested)=>canonical==requested || source==requested;
    private static MlbTeam Team(MlbSeasonData d,string id)=>d.Teams.SingleOrDefault(t=>Match(t.Id,t.SourceId,id))??throw new MlbDataException(404,"MLB team not found in this season.");
    private static MlbPlayer Player(MlbSeasonData d,string id)=>d.Players.SingleOrDefault(t=>Match(t.Id,t.SourceId,id))??throw new MlbDataException(404,"MLB player not found in this season.");
    private static MlbGame Game(MlbSeasonData d,string id)=>d.Games.SingleOrDefault(t=>Match(t.Id,t.SourceId,id))??throw new MlbDataException(404,"MLB game not found in this season.");
    private static MlbPage<T> PageOf<T>(IEnumerable<T> rows,int page,int pageSize)
    {
        if(page<1 || pageSize<1 || pageSize>100 || page>1000000)throw new MlbDataException(400,"Use page >= 1 and pageSize between 1 and 100.");
        var all=rows.ToArray();return new(all.Skip((page-1)*pageSize).Take(pageSize).ToArray(),all.Length,page,pageSize);
    }
    private static IEnumerable<MlbGame> FilterGames(MlbSeasonData d,string? teamId,string? seasonType,string? date,string? status)
    {
        IEnumerable<MlbGame> rows=d.Games;
        if(!string.IsNullOrEmpty(teamId)) { var t=Team(d,teamId);rows=rows.Where(g=>g.HomeTeamId==t.Id || g.AwayTeamId==t.Id); }
        if(!string.IsNullOrEmpty(seasonType))
        {
            var phase=new[]{"Regular Season","Playoffs","Preseason","Exhibition","All-Star"}.SingleOrDefault(p=>p.Equals(seasonType,StringComparison.OrdinalIgnoreCase))??throw new MlbDataException(400,"Unknown MLB season type.");rows=rows.Where(g=>g.SeasonType==phase);
        }
        if(!string.IsNullOrEmpty(date))
        {
            if(!DateOnly.TryParseExact(date,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out _))throw new MlbDataException(400,"Use date YYYY-MM-DD.");rows=rows.Where(g=>g.OfficialDate==date);
        }
        if(!string.IsNullOrEmpty(status))rows=status switch { "completed"=>rows.Where(g=>g.Completed),"not-final"=>rows.Where(g=>!g.Completed),_=>throw new MlbDataException(400,"status must be completed or not-final.") };
        return rows.OrderByDescending(g=>g.OfficialDate).ThenByDescending(g=>g.GameNumber).ThenBy(g=>g.Id,StringComparer.Ordinal);
    }
    [HttpGet("seasons")]public async Task<IActionResult> Seasons(CancellationToken ct)=>Ok((await service.GetSeasonsAsync(ct)).Select(y=>y.ToString(CultureInfo.InvariantCulture)));
    [HttpGet("coverage")]public async Task<IActionResult> Coverage(int? season,CancellationToken ct)=>Ok((await service.GetSeasonAsync(season,ct)).Coverage);
    [HttpGet("teams")]public async Task<IActionResult> Teams(int? season,CancellationToken ct)=>Ok((await service.GetSeasonAsync(season,ct)).Teams.OrderBy(t=>t.Name));
    [HttpGet("teams/{id}")]public async Task<IActionResult> TeamById(string id,int? season,CancellationToken ct)=>Ok(Team(await service.GetSeasonAsync(season,ct),id));
    [HttpGet("players")]
    public async Task<IActionResult> Players(int? season,string? search,string? teamId,int page=1,int pageSize=40,CancellationToken ct=default)
    {
        var d=await service.GetSeasonAsync(season,ct);IEnumerable<MlbPlayer> rows=d.Players;
        if(!string.IsNullOrWhiteSpace(search))rows=rows.Where(p=>p.FullName?.Contains(search.Trim(),StringComparison.OrdinalIgnoreCase)==true);
        if(!string.IsNullOrEmpty(teamId)){var t=Team(d,teamId);rows=rows.Where(p=>p.TeamIds.Contains(t.Id) || p.RosterSnapshotTeamIds.Contains(t.Id));}
        return Ok(PageOf(rows.OrderBy(p=>p.FullName).ThenBy(p=>p.Id),page,pageSize));
    }
    [HttpGet("players/{id}")]public async Task<IActionResult> PlayerById(string id,int? season,CancellationToken ct)=>Ok(Player(await service.GetSeasonAsync(season,ct),id));
    [HttpGet("players/{id}/games")]
    public async Task<IActionResult> PlayerGames(string id,int? season,int page=1,int pageSize=40,CancellationToken ct=default)
    { var d=await service.GetSeasonAsync(season,ct);var ids=Player(d,id).GameIds.ToHashSet();return Ok(PageOf(FilterGames(d,null,null,null,null).Where(g=>ids.Contains(g.Id)),page,pageSize)); }
    [HttpGet("games")]
    public async Task<IActionResult> Games(int? season,string? teamId,string? seasonType,string? date,string? status,int page=1,int pageSize=40,CancellationToken ct=default)
    { var d=await service.GetSeasonAsync(season,ct);return Ok(PageOf(FilterGames(d,teamId,seasonType,date,status),page,pageSize)); }
    [HttpGet("games/{id}")]public async Task<IActionResult> GameById(string id,int? season,CancellationToken ct)=>Ok(Game(await service.GetSeasonAsync(season,ct),id));
    [HttpGet("games/{id}/statistics")]
    public async Task<IActionResult> Statistics(string id,int? season,CancellationToken ct)
    {
        var d=await service.GetSeasonAsync(season,ct);var game=Game(d,id);var f=await service.GetGameFileAsync(d,game,ct);var names=d.Players.ToDictionary(p=>p.Id,p=>p.FullName);
        return Ok(new {game,teamStatistics=f.TeamStatistics,playerStatistics=f.PlayerStatistics.Select(s=>new {s.GameId,s.TeamId,s.PlayerId,playerName=names.GetValueOrDefault(s.PlayerId!),s.Group,s.Statistics,s.Source}),lineScores=f.LineScores});
    }
    [HttpGet("standings")]
    public async Task<IActionResult> Standings(int? season,CancellationToken ct)
    {
        var d=await service.GetSeasonAsync(season,ct);
        return Ok(new {season=d.Season,seasonType="Regular Season",method="Calculated from imported completed regular-season final scores. Ties are retained; win percentage excludes ties. Division grouping uses season team metadata. Official seeding and tiebreakers are not applied.",teams=MlbStandingsCalculator.Calculate(d),providerSnapshot=d.ProviderStandings});
    }
    [HttpGet("batting")]
    public async Task<IActionResult> Batting(int? season,string kind="player",string seasonType="Regular Season",string metric="homeRuns",string? teamId=null,string? search=null,int minPa=0,int minAb=0,int page=1,int pageSize=40,CancellationToken ct=default)
    {
        if(kind is not ("player" or "team"))throw new MlbDataException(400,"kind must be player or team.");
        var d=await service.GetSeasonAsync(season,ct);
        var team=string.IsNullOrEmpty(teamId)?null:Team(d,teamId).Id;
        var f=await service.GetBattingAsync(d,ct);
        var ranked=MlbBattingLeaderboard.Calculate(d,f,kind,seasonType,team,metric,minPa,minAb);
        var matches=string.IsNullOrWhiteSpace(search)?ranked:ranked.Where(r=>r.Name.Contains(search.Trim(),StringComparison.OrdinalIgnoreCase)).ToArray();
        var completed=d.Games.Where(g=>g.Completed && g.SeasonType==seasonType && (team==null || g.HomeTeamId==team || g.AwayTeamId==team)).ToArray();
        return Ok(new {season=d.Season,kind,seasonType,metric,minPa,minAb,rankedTotal=ranked.Length,
            coverage=new {completedGames=completed.Length,expectedTeamGames=completed.Length*(team==null?2:1),observedTeamGames=f.Rows.Where(r=>r.Kind=="team" && r.SeasonType==seasonType && (team==null || r.Id==team)).Sum(r=>r.Games)},
            method="Totals use imported batting observations only. A statistic stays null if any contributing observation is missing it. Rates use complete component totals. Minimum PA/AB are custom filters, not official title qualification. Search preserves ranks within the selected team, phase, and minimums.",
            results=PageOf(matches,page,pageSize)});
    }
    [HttpGet("pitching")]
    public async Task<IActionResult> Pitching(int? season,string kind="player",string seasonType="Regular Season",string metric="strikeOuts",string? teamId=null,string? search=null,string minIp="0",int minGames=0,int page=1,int pageSize=40,CancellationToken ct=default)
    {
        if(kind is not ("player" or "team"))throw new MlbDataException(400,"kind must be player or team.");
        var d=await service.GetSeasonAsync(season,ct);
        var team=string.IsNullOrEmpty(teamId)?null:Team(d,teamId).Id;
        var f=await service.GetPitchingAsync(d,ct);
        var ranked=MlbPitchingLeaderboard.Calculate(d,f,kind,seasonType,team,metric,minIp,minGames);
        var matches=string.IsNullOrWhiteSpace(search)?ranked:ranked.Where(r=>r.Name.Contains(search.Trim(),StringComparison.OrdinalIgnoreCase)).ToArray();
        var completed=d.Games.Where(g=>g.Completed && g.SeasonType==seasonType && (team==null || g.HomeTeamId==team || g.AwayTeamId==team)).ToArray();
        return Ok(new {season=d.Season,kind,seasonType,metric,minIp,minGames,sortDirection=MlbPitchingLeaderboard.Ascending.Contains(metric)?"ascending":"descending",rankedTotal=ranked.Length,
            coverage=new {completedGames=completed.Length,expectedTeamGames=completed.Length*(team==null?2:1),observedTeamGames=f.Rows.Where(r=>r.Kind=="team" && r.SeasonType==seasonType && (team==null || r.Id==team)).Sum(r=>r.Games)},
            method="Totals use imported pitching observations only. A statistic stays null if any contributing observation is missing it. Rates use complete component totals. Minimum IP/appearances are custom filters, not official title qualification. Search preserves ranks within the selected team, phase, and minimums.",
            results=PageOf(matches,page,pageSize)});
    }

    private async Task<MlbSeasonInsights.PlayerProfile> Profile(string id, int? season, string phase, string? teamId, CancellationToken ct)
    {
        MlbSeasonInsights.Phase(phase);
        var d = await service.GetSeasonAsync(season, ct);
        var player = Player(d, id);
        var team = string.IsNullOrEmpty(teamId) ? null : Team(d, teamId);
        return MlbSeasonInsights.Player(d, player, await service.GetBattingAsync(d, ct), await service.GetPitchingAsync(d, ct), phase, team);
    }
    [HttpGet("players/{id}/season-profile")]
    public async Task<IActionResult> SeasonProfile(string id, int? season, string seasonType="Regular Season", string? teamId=null, CancellationToken ct=default)
        => Ok(await Profile(id, season, seasonType, teamId, ct));

    [HttpGet("players/{id}/game-log")]
    public async Task<IActionResult> PlayerGameLog(string id, int? season, string seasonType="Regular Season", string? teamId=null,
        int page=1, int pageSize=20, CancellationToken ct=default)
    {
        MlbSeasonInsights.Phase(seasonType);
        // Validate paging before opening game files.
        PageOf(Array.Empty<int>(), page, pageSize);
        var d=await service.GetSeasonAsync(season,ct);var p=Player(d,id);
        var team=string.IsNullOrEmpty(teamId)?null:Team(d,teamId);
        var ids=p.GameIds.ToHashSet();
        var games=FilterGames(d,team?.Id,seasonType,null,"completed").Where(g=>ids.Contains(g.Id)).ToArray();
        var rows=new List<object>();
        if(team is null)
        {
            foreach(var game in PageOf(games,page,pageSize).Items)
            {
                var file=await service.GetGameFileAsync(d,game,ct);
                rows.Add(new {game,statistics=file.PlayerStatistics.Where(r=>r.PlayerId==p.Id).ToArray()});
            }
            return Ok(new {season=d.Season,seasonType,player=p,results=new MlbPage<object>(rows.ToArray(),games.Length,page,pageSize)});
        }
        // Match actual contributions, not just a game involving the selected team.
        foreach(var game in games)
        {
            var file=await service.GetGameFileAsync(d,game,ct);
            var stats=file.PlayerStatistics.Where(r=>r.PlayerId==p.Id && r.TeamId==team.Id).ToArray();
            if(stats.Length>0)rows.Add(new {game,statistics=stats});
        }
        return Ok(new {season=d.Season,seasonType,player=p,results=PageOf(rows,page,pageSize)});
    }
    [HttpGet("teams/{id}/analytics")]
    public async Task<IActionResult> TeamAnalytics(string id,int? season,string seasonType="Regular Season",CancellationToken ct=default)
    {
        MlbSeasonInsights.Phase(seasonType);
        var d=await service.GetSeasonAsync(season,ct);
        return Ok(MlbSeasonInsights.Team(d,Team(d,id),await service.GetBattingAsync(d,ct),await service.GetPitchingAsync(d,ct),seasonType));
    }
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics(int? season,string seasonType="Regular Season",CancellationToken ct=default)
    {
        MlbSeasonInsights.Phase(seasonType);
        var d=await service.GetSeasonAsync(season,ct);var batting=await service.GetBattingAsync(d,ct);var pitching=await service.GetPitchingAsync(d,ct);
        return Ok(new {season=d.Season,seasonType,method=MlbSeasonInsights.Method,coverage=d.Coverage,
            teams=d.Teams.OrderBy(t=>t.Name).Select(t=>MlbSeasonInsights.Team(d,t,batting,pitching,seasonType)).ToArray()});
    }
    [HttpGet("compare")]
    public async Task<IActionResult> Compare(string leftId,string rightId,int leftSeason,int rightSeason,
        string group="batting",string seasonType="Regular Season",string? leftTeamId=null,string? rightTeamId=null,CancellationToken ct=default)
    {
        if(group is not ("batting" or "pitching"))throw new MlbDataException(400,"group must be batting or pitching.");
        var left=await Profile(leftId,leftSeason,seasonType,leftTeamId,ct);
        var right=await Profile(rightId,rightSeason,seasonType,rightTeamId,ct);
        return Ok(new {group,seasonType,left,right,differences=MlbSeasonInsights.Differences(left,right,group),method=MlbSeasonInsights.Method});
    }

}
