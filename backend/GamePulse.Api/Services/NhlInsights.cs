namespace GamePulse.Api.Services;
public static class NhlInsights
{
 public const string Method="Imported NHL observations only. Missing fields stay unknown. Skater points exclude shootout awards; final-score team goals include the shootout winner's extra goal. TOI is stored as seconds, never decimal minutes. Goalie rates use summed saves/shots and time. Backup goalies without participation evidence do not receive appearances. Rankings use custom minimums, not official qualification; cross-season comparisons are not era-adjusted.";
 public static readonly string[] Skater=["goals","assists","points","plusMinus","penaltyMinutes","shots","hits","blocks","powerPlayGoals","giveaways","takeaways","toiSeconds"];
 public static readonly string[] Goalie=["saves","shotsAgainst","goalsAgainst","wins","losses","overtimeLosses","toiSeconds"];
 public static readonly string[] Team=["goals","goalsAgainst","shots","saves","penaltyMinutes","hits","blocks","powerPlayGoals","giveaways","takeaways"];
 public static string Phase(string phase){if(phase is not("Regular Season" or "Playoffs" or "Preseason" or "All-Star"))throw new NhlDataException(400,"Unknown NHL phase.");return phase;}
 public static string Group(string group,bool team=false){if(group is not("skater" or "goalie")&&!(team&&group=="team"))throw new NhlDataException(400,"Choose skater or goalie.");return group;}
 public sealed record Summary(string Id,string Name,string Group,string[] TeamIds,int Games,int ObservationRows,Dictionary<string,long?> Totals,Dictionary<string,double?> Rates,Dictionary<string,int> ObservedRows);
 public static Summary? Aggregate(string id,string name,string group,IEnumerable<NhlStat> source){
  var rows=source.ToArray();if(rows.Length==0)return null;var keys=group=="goalie"?Goalie:group=="team"?Team:Skater;var totals=new Dictionary<string,long?>();var observed=new Dictionary<string,int>();
  foreach(var k in keys){var values=rows.Select(r=>r.Statistics.GetValueOrDefault(k)).ToArray();observed[k]=values.Count(v=>v.HasValue);totals[k]=values.All(v=>v.HasValue)?values.Sum(v=>v!.Value):null;}
  var games=rows.Select(r=>r.GameId).Distinct().Count();var rates=new Dictionary<string,double?>();
  double? Divide(string a,string b,double scale=1)=>totals.GetValueOrDefault(a) is long n&&totals.GetValueOrDefault(b) is long d&&d>0?scale*n/d:null;
  if(group=="goalie"){rates["savePercentage"]=Divide("saves","shotsAgainst");rates["gaa"]=Divide("goalsAgainst","toiSeconds",3600);}
  else {rates["goalsPerGame"]=totals["goals"] is long g?(double)g/games:null;rates["shotsPerGame"]=totals["shots"] is long s?(double)s/games:null;if(group=="skater"){rates["pointsPerGame"]=totals["points"] is long p?(double)p/games:null;rates["shootingPercentage"]=Divide("goals","shots",100);rates["toiPerGame"]=totals["toiSeconds"] is long t?(double)t/games:null;}}
  return new(id,name,group,rows.Select(r=>r.TeamId).Distinct().Order().ToArray(),games,rows.Length,totals,rates,observed);
 }
 public static Summary? Player(NhlSeason d,string id,string phase,string group,string? team=null)=>Aggregate(id,d.Players.Single(p=>p.Id==id).Name??id,group,d.PlayerStats.Where(r=>r.PlayerId==id&&r.Group==group&&(team==null||r.TeamId==team)&&d.Games.Any(g=>g.Id==r.GameId&&g.SeasonType==phase)));
 public sealed record Record(string Label,int ScheduledGames,int CompletedGames,int ScoredGames,int Wins,int RegulationLosses,int OvertimeLosses,int UnknownResults,int? RegulationWins,int? RegulationOvertimeWins,int? Points,double? PointsPercentage,long? GoalsFor,long? GoalsAgainst,long? GoalDifferential,double? GoalsPerGame);
 public static Record Scores(string label,IEnumerable<NhlGame> source,string team,string phase){
  var scheduled=source.ToArray();var final=scheduled.Where(g=>g.Completed).ToArray();var scored=final.Where(g=>g.HomeScore.HasValue&&g.AwayScore.HasValue).ToArray();
  int Own(NhlGame g)=>(g.HomeTeamId==team?g.HomeScore:g.AwayScore)!.Value;int Opp(NhlGame g)=>(g.HomeTeamId==team?g.AwayScore:g.HomeScore)!.Value;
  var w=scored.Count(g=>Own(g)>Opp(g));var rl=scored.Count(g=>Own(g)<Opp(g)&&g.Finish=="REG");var ol=scored.Count(g=>Own(g)<Opp(g)&&g.Finish is "OT" or "SO");var unknown=final.Length-w-rl-ol;
  int? points=unknown==0&&phase=="Regular Season"?2*w+ol:null;var complete=final.Length>0&&scored.Length==final.Length;long? gf=complete?scored.Sum(g=>(long)Own(g)):null,ga=complete?scored.Sum(g=>(long)Opp(g)):null;
  var unknownWin=scored.Any(g=>Own(g)>Opp(g)&&g.Finish=="Unknown");
  return new(label,scheduled.Length,final.Length,scored.Length,w,rl,ol,unknown,unknownWin?null:scored.Count(g=>Own(g)>Opp(g)&&g.Finish=="REG"),unknownWin?null:scored.Count(g=>Own(g)>Opp(g)&&g.Finish is "REG" or "OT"),points,points.HasValue&&final.Length>0?(double)points/(2*final.Length):null,gf,ga,gf-ga,complete?(double)gf!.Value/final.Length:null);
 }
 public static object TeamProfile(NhlSeason d,NhlEntity team,string phase){var games=d.Games.Where(g=>g.SeasonType==phase&&(g.HomeTeamId==team.Id||g.AwayTeamId==team.Id)).ToArray();var ids=games.Select(g=>g.Id).ToHashSet();var rows=d.TeamStats.Where(r=>r.TeamId==team.Id&&ids.Contains(r.GameId)).ToArray();return new{team,season=d.Season,seasonType=phase,record=Scores("Season",games,team.Id,phase),statistics=Aggregate(team.Id,team.Name??team.Id,"team",rows),missingBoxGames=games.Count(g=>g.Completed)-rows.Length,homeAway=new[]{Scores("Home",games.Where(g=>g.HomeTeamId==team.Id),team.Id,phase),Scores("Away",games.Where(g=>g.AwayTeamId==team.Id),team.Id,phase)},months=games.GroupBy(g=>g.Date[..7]).OrderBy(g=>g.Key).Select(g=>Scores(g.Key,g,team.Id,phase)).ToArray()};}
}
