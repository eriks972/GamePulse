using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
namespace GamePulse.Api.Services;

public sealed class NhlDataException(int status,string message):Exception(message){public int Status{get;}=status;}
public sealed class NhlEntity { public string Id{get;set;}="";public string? Name{get;set;} public string? Abbreviation{get;set;} public string? Position{get;set;} public string[] TeamIds{get;set;}=[]; public string[] GameIds{get;set;}=[]; }
public sealed class NhlGame { public string Id{get;set;}="";public int Season{get;set;}public string SeasonType{get;set;}="";public string Date{get;set;}="";public string? StartTime{get;set;}public string HomeTeamId{get;set;}="";public string AwayTeamId{get;set;}="";public int? HomeScore{get;set;}public int? AwayScore{get;set;}public bool Completed{get;set;}public string? Status{get;set;}public string? Venue{get;set;}public string Finish{get;set;}="Unknown";public bool ScoringComplete{get;set;} }
public sealed class NhlStat {public string GameId{get;set;}="";public string TeamId{get;set;}="";public string? PlayerId{get;set;}public string Group{get;set;}="";public Dictionary<string,long?> Statistics{get;set;}=[];}
public sealed class NhlSeason {public int Version{get;set;}public string League{get;set;}="";public int Season{get;set;}public string Label{get;set;}="";public NhlEntity[] Teams{get;set;}=[];public NhlEntity[] Players{get;set;}=[];public NhlGame[] Games{get;set;}=[];public NhlStat[] TeamStats{get;set;}=[];public NhlStat[] PlayerStats{get;set;}=[];public JsonElement[] Scoring{get;set;}=[];public JsonElement Coverage{get;set;}public JsonElement Provenance{get;set;}}
public sealed class NhlDataService:IAsyncDisposable
{
 private readonly string root;private readonly ILogger<NhlDataService> logger;private readonly MemoryCache cache=new(new MemoryCacheOptions{SizeLimit=1});private readonly SemaphoreSlim gate=new(1,1);private static readonly JsonSerializerOptions options=new(){PropertyNameCaseInsensitive=true};
 public NhlDataService(IHostEnvironment env,IConfiguration config,ILogger<NhlDataService> log){logger=log;root=Path.GetFullPath(config["Nhl:DataPath"]??"Data/processed/nhl",env.ContentRootPath);}
 public int[] Seasons()=>Directory.Exists(Path.Combine(root,"seasons"))?Directory.GetDirectories(Path.Combine(root,"seasons")).Where(p=>File.Exists(Path.Combine(p,"current.json"))).Select(Path.GetFileName).Where(s=>Regex.IsMatch(s??"",@"^\d{4}$")).Select(s=>int.Parse(s!)).OrderDescending().ToArray():[];
 public async Task<NhlSeason> Get(int? requested,CancellationToken ct=default)
 {
  try{
   var years=Seasons();if(years.Length==0)throw new NhlDataException(503,"NHL data has not been imported yet.");var year=requested??years[0];if(!years.Contains(year))throw new NhlDataException(404,"NHL season is not imported.");
   var folder=Path.Combine(root,"seasons",year.ToString());var pointer=JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(folder,"current.json"),ct))!;var run=pointer["runId"]?.GetValue<string>()??"";var hash=pointer["sha256"]?.GetValue<string>()??"";
   if(pointer["version"]?.GetValue<int>()!=1||pointer["league"]?.GetValue<string>()!="nhl"||pointer["season"]?.GetValue<int>()!=year||!Regex.IsMatch(run,@"^\d{8}T\d{6}-[a-f0-9]{8}$")||!Regex.IsMatch(hash,"^[a-f0-9]{64}$"))throw new JsonException("Invalid NHL pointer");
   var key=$"{year}/{run}/{hash}";if(cache.TryGetValue<NhlSeason>(key,out var hit))return hit!;
   await gate.WaitAsync(ct);try{
    if(cache.TryGetValue<NhlSeason>(key,out hit))return hit!;
    var path=Path.Combine(folder,"runs",run,"season.json.gz");await using var raw=File.OpenRead(path);
    var actual=Convert.ToHexString(await SHA256.HashDataAsync(raw,ct)).ToLowerInvariant();if(actual!=hash)throw new JsonException("NHL checksum mismatch");raw.Position=0;
    await using var gz=new GZipStream(raw,CompressionMode.Decompress);var data=await JsonSerializer.DeserializeAsync<NhlSeason>(gz,options,ct)??throw new JsonException("Null NHL data");Validate(data,year);
    cache.Set(key,data,new MemoryCacheEntryOptions{Size=1,SlidingExpiration=TimeSpan.FromMinutes(15)});return data;
   }finally{gate.Release();}
  }catch(NhlDataException){throw;}catch(Exception ex)when(ex is IOException or JsonException or InvalidDataException or InvalidOperationException or FormatException or UnauthorizedAccessException or NullReferenceException or ArgumentException or KeyNotFoundException){logger.LogError(ex,"Unable to read NHL snapshot");throw new NhlDataException(503,"NHL data is unavailable or invalid. Check the import and backend logs.");}
 }
 private static void Validate(NhlSeason d,int year){
  if(d.Version!=1||d.League!="nhl"||d.Season!=year||d.Teams.Length==0||d.Games.Length==0||d.Coverage.GetProperty("season").GetInt32()!=year)throw new JsonException("Invalid NHL envelope");
  var teams=d.Teams.Select(t=>t.Id).ToHashSet();var players=d.Players.Select(p=>p.Id).ToHashSet();var games=d.Games.ToDictionary(g=>g.Id);
  if(teams.Count!=d.Teams.Length||players.Count!=d.Players.Length||teams.Any(id=>!Regex.IsMatch(id,@"^nhl:team:[1-9]\d*$"))||players.Any(id=>!Regex.IsMatch(id,@"^nhl:player:[1-9]\d*$")))throw new JsonException("Invalid identities");
  if(d.Games.Any(g=>g.Season!=year||!Regex.IsMatch(g.Id,@"^\d{10}$")||!teams.Contains(g.HomeTeamId)||!teams.Contains(g.AwayTeamId)||g.HomeTeamId==g.AwayTeamId||g.HomeScore<0||g.AwayScore<0||!DateOnly.TryParseExact(g.Date,"yyyy-MM-dd",out _)||!new[]{"REG","OT","SO","Unknown"}.Contains(g.Finish)))throw new JsonException("Invalid NHL game");
  foreach(var r in d.TeamStats.Concat(d.PlayerStats)){
   if(!games.TryGetValue(r.GameId,out var g)||!g.Completed||r.TeamId!=g.HomeTeamId&&r.TeamId!=g.AwayTeamId||r.Group is not("team" or "skater" or "goalie")||r.Group=="team"&&r.PlayerId!=null||r.Group!="team"&&(r.PlayerId==null||!players.Contains(r.PlayerId))||r.Statistics.Any(v=>v.Value<0&&v.Key!="plusMinus"))throw new JsonException("Invalid NHL statistics");
  }
  if(d.TeamStats.Any(r=>r.Group!="team")||d.PlayerStats.Any(r=>r.Group=="team")||d.TeamStats.Concat(d.PlayerStats).GroupBy(r=>(r.GameId,r.TeamId,r.PlayerId,r.Group)).Any(g=>g.Count()!=1)||d.Players.Any(p=>p.TeamIds.Any(t=>!teams.Contains(t))||p.GameIds.Any(id=>!games.ContainsKey(id))))throw new JsonException("Duplicate NHL rows or references");
  if(d.Scoring.Any(e=>!games.TryGetValue(e.GetProperty("gameId").GetString()!,out var g)||!g.Completed||!new[]{g.HomeTeamId,g.AwayTeamId}.Contains(e.GetProperty("teamId").GetString())))throw new JsonException("Invalid goal event");
 }
 public ValueTask DisposeAsync(){cache.Dispose();gate.Dispose();return ValueTask.CompletedTask;}
}
