using System.Globalization;
using System.Text.RegularExpressions;
using GamePulse.Api.Models.Mlb;
namespace GamePulse.Api.Services;
public static class MlbPitchingLeaderboard
{
    public static readonly string[] Counts = ["outsRecorded","gamesStarted","wins","losses","saves","holds","blownSaves","hits","runs","earnedRuns","homeRuns","baseOnBalls","strikeOuts","hitBatsmen","battersFaced","numberOfPitches","wildPitches","balks"];
    public static readonly string[] Rates = ["era","whip","kPer9","bbPer9","hPer9","hrPer9","kToBb"];
    public static readonly string[] Ascending = ["era","whip","bbPer9","hPer9","hrPer9"];
    public static long ParseMinimumIp(string value)
    {
        if(!Regex.IsMatch(value,@"^\d{1,6}(\.[012])?$") || !long.TryParse(value.Split('.')[0],out var innings) || innings>100000)
            throw new MlbDataException(400,"Minimum IP must use innings and outs, e.g. 5.2 (five innings, two outs), up to 100000 innings.");
        return innings*3+(value.Contains('.')?value[^1]-'0':0);
    }
    public static string? Innings(long? outs)=>outs is null?null:$"{outs/3}.{outs%3}";
    public static double? Rate(Dictionary<string,long?> t,string key)
    {
        string[] required=key switch {"era"=>["earnedRuns","outsRecorded"],"whip"=>["hits","baseOnBalls","outsRecorded"],"kPer9"=>["strikeOuts","outsRecorded"],"bbPer9"=>["baseOnBalls","outsRecorded"],"hPer9"=>["hits","outsRecorded"],"hrPer9"=>["homeRuns","outsRecorded"],_=>["strikeOuts","baseOnBalls"]};
        if(required.Any(k=>t[k]==null))return null;
        double N(string k)=>t[k]??0;
        if(key=="kToBb")return N("baseOnBalls")>0?N("strikeOuts")/N("baseOnBalls"):null;
        var outs=N("outsRecorded");if(outs<=0)return null;
        if(key=="whip")return 3*(N("hits")+N("baseOnBalls"))/outs;
        var numerator=key switch {"era"=>"earnedRuns","kPer9"=>"strikeOuts","bbPer9"=>"baseOnBalls","hPer9"=>"hits",_=>"homeRuns"};
        return 27*N(numerator)/outs;
    }
    public sealed record Entry(int Rank,string Id,string Name,string[] TeamIds,int Games,int ObservationRows,string? InningsPitched,
        Dictionary<string,long?> Totals,Dictionary<string,double?> Rates,Dictionary<string,int> ObservedRows,double Value);
    public static Entry[] Calculate(MlbSeasonData data,MlbPitchingFile file,string kind,string phase,string? teamId,string metric,string minIp,int minGames)
    {
        if(!Counts.Contains(metric) && !Rates.Contains(metric))throw new MlbDataException(400,"Unknown pitching metric.");
        var minOuts=ParseMinimumIp(minIp);
        if(minGames<0 || minGames>100000)throw new MlbDataException(400,"Minimum appearances must be between 0 and 100000.");
        if(!new[]{"Regular Season","Playoffs","Preseason","Exhibition","All-Star"}.Contains(phase))throw new MlbDataException(400,"Unknown MLB season type.");
        var names=kind=="player"?data.Players.ToDictionary(p=>p.Id,p=>p.FullName??p.Id):data.Teams.ToDictionary(t=>t.Id,t=>t.Name??t.Id);
        double? Value(MlbPitchingRow r)=>Rates.Contains(metric)?r.Rates[metric]:r.Totals[metric];
        var eligible=file.Rows.Where(r=>r.Kind==kind && r.SeasonType==phase && (kind=="player"?r.TeamId==teamId:teamId==null || r.Id==teamId))
            .Where(r=>(minOuts==0 || r.Totals["outsRecorded"]>=minOuts) && r.Games>=minGames && Value(r)!=null);
        var sorted=(Ascending.Contains(metric)?eligible.OrderBy(Value):eligible.OrderByDescending(Value))
            .ThenBy(r=>names[r.Id],StringComparer.Ordinal).ThenBy(r=>r.Id,StringComparer.Ordinal).ToArray();
        var result=new List<Entry>();double? previous=null;int rank=0;
        for(int i=0;i<sorted.Length;i++)
        {
            var r=sorted[i];var value=Value(r)!.Value;if(previous!=value)rank=i+1;previous=value;
            result.Add(new(rank,r.Id,names[r.Id],r.TeamIds,r.Games,r.ObservationRows,r.InningsPitched,r.Totals,r.Rates,r.ObservedRows,value));
        }
        return result.ToArray();
    }
}
