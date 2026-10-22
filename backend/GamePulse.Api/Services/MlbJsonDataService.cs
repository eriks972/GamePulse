using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using GamePulse.Api.Models.Mlb;
using Microsoft.Extensions.Caching.Memory;
namespace GamePulse.Api.Services;

public sealed class MlbDataException(int statusCode, string message) : Exception(message) { public int StatusCode { get; } = statusCode; }
public sealed class MlbJsonDataService : IDisposable
{
    private readonly string _root;
    private readonly ILogger<MlbJsonDataService> _logger;
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 1 });
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };
    private sealed class Pointer { public int Version { get; set; } public string League { get; set; } = ""; public string Run { get; set; } = ""; }
    public MlbJsonDataService(IHostEnvironment env, IConfiguration config, ILogger<MlbJsonDataService> logger)
    {
        _root = Path.GetFullPath(config["Mlb:DataPath"] ?? Path.Combine("Data", "processed", "mlb"), env.ContentRootPath); _logger = logger;
    }
    private async Task<(string Directory, int[] Years)> Snapshot(CancellationToken ct)
    {
        var pointer = await Read<Pointer>(Path.Combine(_root, "current.json"), ct);
        if (pointer.Version != 1 || pointer.League != "mlb" || !Regex.IsMatch(pointer.Run, @"^runs/[A-Za-z0-9-]+$")) throw new JsonException("Invalid MLB import pointer");
        var dir = Path.Combine(_root, pointer.Run); var years = await Read<int[]>(Path.Combine(dir, "seasons.json"), ct);
        if (years.Length == 0 || years.Any(y => y < 1876 || y > 9999)) throw new JsonException("Invalid MLB season index");
        return (dir, years.Distinct().OrderDescending().ToArray());
    }
    private async Task<T> Guard<T>(Func<Task<T>> operation)
    {
        try { return await operation(); }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or NullReferenceException)
        {
            _logger.LogError(ex, "Unable to read imported MLB data");
            throw new MlbDataException(503, "MLB data is unavailable or invalid. Check the import and backend logs.");
        }
    }
    public Task<int[]> GetSeasonsAsync(CancellationToken ct = default) => Guard(async () => (await Snapshot(ct)).Years);
    public Task<MlbSeasonData> GetSeasonAsync(int? requested, CancellationToken ct = default) => Guard(async () =>
    {
        var snapshot = await Snapshot(ct); var year = requested ?? snapshot.Years[0];
        if (!snapshot.Years.Contains(year)) throw new MlbDataException(404, $"MLB season {year} has not been imported.");
        var key = (snapshot.Directory, year);
        if (_cache.TryGetValue<MlbSeasonData>(key, out var cached) && cached is not null) return cached;
        await _gate.WaitAsync(ct);
        try
        {
            if (_cache.TryGetValue<MlbSeasonData>(key, out cached) && cached is not null) return cached;
            var dir = Path.Combine(snapshot.Directory, "seasons", year.ToString(CultureInfo.InvariantCulture));
            var teams = await Read<MlbTeam[]>(Path.Combine(dir, "teams.json"), ct);
            var players = await Read<MlbPlayer[]>(Path.Combine(dir, "players.json"), ct);
            var games = await Read<MlbGame[]>(Path.Combine(dir, "games.json"), ct);
            var standings = await Read<MlbProviderStanding[]>(Path.Combine(dir, "standings.json"), ct);
            var coverage = await Read<JsonElement>(Path.Combine(dir, "coverage.json"), ct);
            Validate(year, teams, players, games, standings, coverage);
            var teamIndex = teams.ToDictionary(t => t.Id);
            foreach (var game in games) { game.HomeTeamName = teamIndex[game.HomeTeamId].Name; game.AwayTeamName = teamIndex[game.AwayTeamId].Name; }
            var season = new MlbSeasonData(year, dir, teams, players, games, standings, coverage);
            _cache.Set(key, season, new MemoryCacheEntryOptions { Size = 1, SlidingExpiration = TimeSpan.FromMinutes(15) }); return season;
        }
        finally { _gate.Release(); }
    });
    public Task<MlbGameFile> GetGameFileAsync(MlbSeasonData data, MlbGame game, CancellationToken ct = default) => Guard(async () =>
    {
        var file = await Read<MlbGameFile>(Path.Combine(data.Directory, "game_stats", game.SourceId + ".json"), ct);
        var players = data.Players.Select(p => p.Id).ToHashSet();
        foreach (var stat in file.TeamStatistics.Concat(file.PlayerStatistics))
        {
            if (stat.GameId != game.Id || stat.Season != data.Season || stat.SeasonType != game.SeasonType || !game.Completed ||
                stat.TeamId != game.HomeTeamId && stat.TeamId != game.AwayTeamId ||
                stat.OpponentTeamId != (stat.TeamId == game.HomeTeamId ? game.AwayTeamId : game.HomeTeamId) ||
                stat.Group is not ("batting" or "pitching" or "fielding") || stat.Statistics is null)
                throw new JsonException("Invalid MLB game statistics relationship");
            foreach (var (name, value) in stat.Statistics)
            {
                if (value.ValueKind == JsonValueKind.Null) continue;
                if (name == "inningsPitched" && value.ValueKind == JsonValueKind.String && Regex.IsMatch(value.GetString()!, @"^\d+(\.[012])?$")) continue;
                if (value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var n) || !double.IsFinite(n) || n < 0) throw new JsonException("Invalid statistic value");
            }
        }
        if (file.PlayerStatistics.Any(p => p.PlayerId is null || !players.Contains(p.PlayerId)) ||
            file.TeamStatistics.Select(p => (p.TeamId,p.Group)).Distinct().Count() != file.TeamStatistics.Length ||
            file.PlayerStatistics.Select(p => (p.TeamId,p.PlayerId,p.Group)).Distinct().Count() != file.PlayerStatistics.Length ||
            file.LineScores.Any(l => l.GameId != game.Id || l.TeamId != game.HomeTeamId && l.TeamId != game.AwayTeamId || l.Inning < 1 || l.Runs < 0 || l.Hits < 0 || l.Errors < 0 || l.LeftOnBase < 0) ||
            file.LineScores.Select(l => (l.TeamId,l.Inning)).Distinct().Count() != file.LineScores.Length ||
            file.TeamStatistics.Length != game.Coverage.TeamGroupRows || file.PlayerStatistics.Length != game.Coverage.PlayerGroupRows || file.LineScores.Length != game.Coverage.InningRows)
            throw new JsonException("Invalid MLB game file coverage or duplicate records");
        return file;
    });
    public Task<MlbBattingFile> GetBattingAsync(MlbSeasonData data, CancellationToken ct = default) => Guard(async () =>
    {
        var path=Path.Combine(data.Directory,"batting.json");
        if(!File.Exists(path))throw new MlbDataException(503,"Batting summaries are not imported. Rerun the updated MLB importer and deploy its active snapshot.");
        var file=await Read<MlbBattingFile>(path,ct);
        var teams=data.Teams.Select(t=>t.Id).ToHashSet();var players=data.Players.Select(p=>p.Id).ToHashSet();var phases=data.Games.Select(g=>g.SeasonType).ToHashSet();
        if(file.Version!=1 || file.Season!=data.Season || file.Rows.Select(r=>(r.Kind,r.Id,r.SeasonType,r.TeamId)).Distinct().Count()!=file.Rows.Length)
            throw new JsonException("Invalid batting summary version, season, or duplicates");
        foreach(var r in file.Rows)
        {
            if(r.Kind is not ("team" or "player") || !(r.Kind=="team"?teams:players).Contains(r.Id) ||
                r.TeamId!=null && !teams.Contains(r.TeamId) || r.Kind=="team" && r.TeamId!=r.Id ||
                r.TeamIds.Length==0 || r.TeamIds.Distinct().Count()!=r.TeamIds.Length || r.TeamIds.Any(t=>!teams.Contains(t)) ||
                r.TeamId!=null && (r.TeamIds.Length!=1 || r.TeamIds[0]!=r.TeamId) ||
                !phases.Contains(r.SeasonType) || r.Games<1 || r.ObservationRows<r.Games)
                throw new JsonException("Invalid batting summary relationships");
            foreach(var key in MlbBattingLeaderboard.Counts)
                if(!r.Totals.ContainsKey(key) || !r.ObservedRows.TryGetValue(key,out var count) || count<0 || count>r.ObservationRows ||
                    r.Totals[key]<0 || (count==r.ObservationRows)!=(r.Totals[key]!=null))throw new JsonException("Invalid batting count coverage");
            double? Rate(string key)
            {
                string[] required=key switch {"avg"=>["hits","atBats"],"slg"=>["totalBases","atBats"],"obp"=>["hits","atBats","baseOnBalls","hitByPitch","sacFlies"],_=>["hits","atBats","baseOnBalls","hitByPitch","sacFlies","totalBases"]};
                if(required.Any(k=>r.Totals[k]==null))return null;
                double N(string k)=>r.Totals[k]??0;
                var ab=N("atBats");var denominator=ab+N("baseOnBalls")+N("hitByPitch")+N("sacFlies");
                double? avg=ab>0?N("hits")/ab:null, slg=ab>0?N("totalBases")/ab:null;
                double? obp=denominator>0?(N("hits")+N("baseOnBalls")+N("hitByPitch"))/denominator:null;
                return key switch {"avg"=>avg,"obp"=>obp,"slg"=>slg,_=>obp+slg};
            }
            foreach(var key in MlbBattingLeaderboard.Rates)
            {
                var expected=Rate(key);
                if(!r.Rates.TryGetValue(key,out var value) || value.HasValue!=expected.HasValue || value.HasValue &&
                    (!double.IsFinite(value.Value) || Math.Abs(value.Value-expected!.Value)>1e-12 || value<0 || value>(key=="ops"?5:key=="slg"?4:1)))throw new JsonException("Invalid batting rate or components");
            }
        }
        return file;
    });
    private static async Task<T> Read<T>(string path, CancellationToken ct)
    { await using var s = File.OpenRead(path); return await JsonSerializer.DeserializeAsync<T>(s, Options, ct) ?? throw new JsonException("Unexpected null JSON"); }
    private static bool Id(string id, string kind) => Regex.IsMatch(id, "^mlb:stats:"+kind+@":[1-9]\d*$");
    private static void Validate(int year, MlbTeam[] teams, MlbPlayer[] players, MlbGame[] games, MlbProviderStanding[] standings, JsonElement coverage)
    {
        if (teams.Length == 0 || games.Length == 0 || teams.Any(t => !Id(t.Id,"team") || t.SourceId != t.Id.Split(':')[^1] || t.Season != year) ||
            players.Any(p => !Id(p.Id,"player") || p.SourceId != p.Id.Split(':')[^1] || p.Season != year) ||
            games.Any(g => !Id(g.Id,"game") || g.SourceId != g.Id.Split(':')[^1] || g.Season != year || g.HomeScore < 0 || g.AwayScore < 0 || !DateOnly.TryParseExact(g.OfficialDate,"yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out _)) ||
            teams.Select(t=>t.Id).Distinct().Count()!=teams.Length || players.Select(p=>p.Id).Distinct().Count()!=players.Length || games.Select(g=>g.Id).Distinct().Count()!=games.Length)
            throw new JsonException("Invalid MLB identities");
        var teamIds=teams.Select(t=>t.Id).ToHashSet();var gameIds=games.Select(g=>g.Id).ToHashSet();
        if (games.Any(g=>g.HomeTeamId==g.AwayTeamId || !teamIds.Contains(g.HomeTeamId) || !teamIds.Contains(g.AwayTeamId) || g.Coverage.TeamGroupRows<0 || g.Coverage.PlayerGroupRows<0 || g.Coverage.InningRows<0) ||
            players.Any(p=>p.TeamIds.Concat(p.RosterSnapshotTeamIds).Any(t=>!teamIds.Contains(t)) || p.GameIds.Any(g=>!gameIds.Contains(g))) ||
            standings.Any(s=>s.Season!=year || !teamIds.Contains(s.TeamId) || s.Wins<0 || s.Losses<0) || standings.Select(s=>s.TeamId).Distinct().Count()!=standings.Length ||
            coverage.ValueKind!=JsonValueKind.Object || !coverage.TryGetProperty("season",out var y) || !y.TryGetInt32(out var reportYear) || reportYear!=year)
            throw new JsonException("Invalid MLB references or coverage");
    }
    public void Dispose() { _cache.Dispose(); _gate.Dispose(); }
}
