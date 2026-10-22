using GamePulse.Api.Models.Mlb;
namespace GamePulse.Api.Services;
public static class MlbBattingLeaderboard
{
    public static readonly string[] Counts = ["plateAppearances","atBats","runs","hits","doubles","triples","homeRuns","rbi","baseOnBalls","strikeOuts","stolenBases","hitByPitch","sacFlies","totalBases"];
    public static readonly string[] Rates = ["avg","obp","slg","ops"];
    public sealed record Entry(int Rank, string Id, string Name, string[] TeamIds, int Games, int ObservationRows,
        Dictionary<string,long?> Totals, Dictionary<string,double?> Rates, Dictionary<string,int> ObservedRows, double Value);
    public static Entry[] Calculate(MlbSeasonData data, MlbBattingFile file, string kind, string phase, string? teamId, string metric, int minPa, int minAb)
    {
        if (!Counts.Contains(metric) && !Rates.Contains(metric)) throw new MlbDataException(400,"Unknown batting metric.");
        if (minPa<0 || minPa>100000 || minAb<0 || minAb>100000) throw new MlbDataException(400,"Minimum PA and AB must be between 0 and 100000.");
        if (!new[]{"Regular Season","Playoffs","Preseason","Exhibition","All-Star"}.Contains(phase)) throw new MlbDataException(400,"Unknown MLB season type.");
        var names = kind=="player" ? data.Players.ToDictionary(p=>p.Id,p=>p.FullName??p.Id) : data.Teams.ToDictionary(t=>t.Id,t=>t.Name??t.Id);
        double? Value(MlbBattingRow r) => Rates.Contains(metric) ? r.Rates[metric] : r.Totals[metric];
        var sorted=file.Rows.Where(r=>r.Kind==kind && r.SeasonType==phase && (kind=="player" ? r.TeamId==teamId : teamId==null || r.Id==teamId))
            .Where(r=>(minPa==0 || r.Totals["plateAppearances"]>=minPa) && (minAb==0 || r.Totals["atBats"]>=minAb) && Value(r)!=null)
            .OrderByDescending(Value).ThenBy(r=>names[r.Id],StringComparer.Ordinal).ThenBy(r=>r.Id,StringComparer.Ordinal).ToArray();
        var result=new List<Entry>();double? previous=null;int rank=0;
        for (int i=0;i<sorted.Length;i++)
        {
            var r=sorted[i];var value=Value(r)!.Value;
            if(previous!=value)rank=i+1;previous=value;
            result.Add(new(rank,r.Id,names[r.Id],r.TeamIds,r.Games,r.ObservationRows,r.Totals,r.Rates,r.ObservedRows,value));
        }
        return result.ToArray();
    }
}
