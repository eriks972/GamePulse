using GamePulse.Api.Models.Mlb;
namespace GamePulse.Api.Services;
public static class MlbStandingsCalculator
{
    public static MlbStanding[] Calculate(MlbSeasonData data) => data.Teams.Select(team =>
    {
        var scheduled=data.Games.Where(g=>g.SeasonType=="Regular Season" && (g.HomeTeamId==team.Id || g.AwayTeamId==team.Id)).ToArray();
        var complete=scheduled.Where(g=>g.Completed).ToArray();var valid=complete.Where(g=>g.HomeScore.HasValue && g.AwayScore.HasValue).ToArray();
        int Own(MlbGame g)=>(g.HomeTeamId==team.Id?g.HomeScore:g.AwayScore)!.Value;
        int Opp(MlbGame g)=>(g.HomeTeamId==team.Id?g.AwayScore:g.HomeScore)!.Value;
        var wins=valid.Count(g=>Own(g)>Opp(g));var losses=valid.Count(g=>Own(g)<Opp(g));
        return new MlbStanding(team,scheduled.Length,complete.Length,valid.Length,complete.Length-valid.Length,wins,losses,valid.Count(g=>Own(g)==Opp(g)),wins+losses>0?(double)wins/(wins+losses):null,valid.Sum(Own),valid.Sum(Opp));
    }).OrderBy(t=>t.Team.League?.Name).ThenBy(t=>t.Team.Division?.Name).ThenByDescending(t=>t.WinPercentage).ThenBy(t=>t.Team.Name).ToArray();
}
