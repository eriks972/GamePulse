using System.Text.Json;
using GamePulse.Api.Controllers;
using GamePulse.Api.Models.Mls;
using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

var count = 0;
void Check(bool condition, string message) { count++; if (!condition) throw new Exception(message); }
async Task Error(int status, Func<Task> action) { try { await action(); throw new Exception($"Expected {status}"); } catch (MlsDataException e) { Check(e.Status == status, $"Expected {status}, got {e.Status}"); } }
JsonElement Body(IActionResult result) => JsonSerializer.SerializeToElement(((ObjectResult)result).Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
var root = Path.Combine(Path.GetTempPath(), "gamepulse-mls-checks-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
var env = new TestEnvironment { ContentRootPath = root };
var service = new MlsDataService(env, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Mls:DataPath"] = root }).Build(), NullLogger<MlsDataService>.Instance);
var api = new MlsController(service);
var ct = CancellationToken.None;
MlsSeason Fixture() => new()
{
    Season = 2026,
    Teams = [new() { Id = "a", Name = "Alpha" }, new() { Id = "b", Name = "Beta" }, new() { Id = "c", Name = "No Results" }],
    Players = [new() { Id = "p", Name = "Player", TeamId = "b", ObservedTeamIds = ["a", "b"] }, new() { Id = "q", Name = "No Stats", TeamId = "a" }],
    Games = [new() { Id = "win", Date = "2026-03-01T01:00Z", HomeTeamId = "a", AwayTeamId = "b", Completed = true, HomeScore = 2, AwayScore = 0 },
        new() { Id = "draw", Date = "2026-03-02", HomeTeamId = "b", AwayTeamId = "a", Completed = true, HomeScore = 1, AwayScore = 1 },
        new() { Id = "missing", Date = "2026-03-03", HomeTeamId = "a", AwayTeamId = "b", Completed = true },
        new() { Id = "shootout", Date = "2026-03-04", HomeTeamId = "a", AwayTeamId = "b", Completed = true, HomeScore = 4, AwayScore = 3, Shootout = true },
        new() { Id = "post", Date = "2026-03-05", HomeTeamId = "a", AwayTeamId = "b", Completed = true, HomeScore = 0, AwayScore = 9, SeasonType = "Playoffs" }],
    TeamStats = [new() { Id = "a", Statistics = new() { ["goals"] = 3, ["games"] = 2 } }, new() { Id = "b", Statistics = new() { ["goals"] = null, ["games"] = 2 } }],
    PlayerStats = [new() { Id = "p", Statistics = new() { ["goals"] = 2, ["assists"] = null, ["games"] = 2 } }],
    GamePlayerStats = [new() { GameId = "win", TeamId = "a", PlayerId = "p", Statistics = new() { ["goals"] = 1 } }],
};
async Task Write(MlsSeason data) => await File.WriteAllTextAsync(Path.Combine(root, "2026.json"), JsonSerializer.Serialize(data));
try
{
    Check(service.Seasons().Length == 0, "No seasons before import");
    Check(Body(await api.Season(null, ct)).GetProperty("data").ValueKind == JsonValueKind.Null, "Aggregate empty state");
    await Error(503, async () => await service.Get(null));
    await Error(400, async () => await service.Get(12));
    await Write(Fixture());
    var data = await service.Get(null);
    Check(data.Season == 2026 && data.Games[0].Date == "2026-03-01" && data.Games[0].StartTime == "2026-03-01T01:00Z", "Timestamp dates normalize; start time retained");
    Check(service.Seasons().SequenceEqual([2026]), "New import discovered without restart");
    await Error(404, async () => await service.Get(2025));
    var record = MlsInsights.Standings(data)[0].Record;
    Check(record.Wins == 1 && record.Draws == 1 && record.Losses == 0 && record.Points == 4, "Soccer points exclude playoffs, missing scores, shootouts");
    Check(record.GoalsFor == 3 && record.GoalsAgainst == 1 && record.GoalsPerGame == 1.5, "Scored observations only");
    Check(record.MissingScoreGames == 1 && record.ExcludedShootoutGames == 1, "Incomplete coverage explicit");
    Check(MlsInsights.Scores(data.Games, "c", "Regular Season").GoalsFor == null, "No observations not invented zero");
    Check(MlsInsights.Scores(data.Games, "a", "Playoffs").Points == null, "No playoff standings points");
    Check(Body(await api.Players(2026, null, "a", null, 1, 1)).GetProperty("total").GetInt32() == 2, "Player team history filter and pagination");
    Check(Body(await api.Games(2026, null, "2026-03-01", "completed")).GetProperty("total").GetInt32() == 1, "Date filter handles timestamp imports");
    Check(Body(await api.PlayerGames("p", 2026)).GetProperty("results").GetProperty("total").GetInt32() == 1, "Only observed appearances");
    Check(Body(await api.PlayerGames("q", 2026)).GetProperty("results").GetProperty("total").GetInt32() == 0, "Roster not treated as participation");
    Check(Body(await api.GameStatistics("win", 2026, ct)).GetProperty("available").GetBoolean(), "Imported match statistics connected");
    Check(!Body(await api.GameStatistics("draw", 2026, ct)).GetProperty("available").GetBoolean(), "No season totals substituted for match stats");
    var ranked = Body(await api.Statistics(2026, "team")).GetProperty("results").GetProperty("items");
    Check(ranked[0].GetProperty("id").GetString() == "a" && ranked[1].GetProperty("rank").ValueKind == JsonValueKind.Null, "Unknown metric values rank last without invented ranks");
    Check(Body(await api.Compare("p", "q", 2026, 2026)).GetProperty("differences").GetProperty("goals").ValueKind == JsonValueKind.Null, "Missing comparison metrics stay unknown");
    await Error(400, async () => await api.Players(2026, null, null, null, 0));
    await Error(400, async () => await api.Games(2026, null, "bad", null));
    await Error(400, async () => await api.Statistics(2026, metric: "bad"));
    await Error(400, async () => await api.Statistics(2026, teamId: "a"));
    await Error(404, async () => await api.GameById("bad", 2026, ct));
    await Error(400, async () => await api.Analytics(2026, "bad"));
    var replacement = Fixture(); replacement.Teams[0].Name = "Updated"; await Write(replacement);
    Check((await service.Get(2026)).Teams[0].Name == "Updated", "Replacement read without restart");
    foreach (var mutate in new Action<MlsSeason>[] {
        d => d.Teams[1].Id = "a", d => d.Games[0].AwayTeamId = "missing", d => d.Games[0].Date = "bad",
        d => d.PlayerStats[0].Id = "missing", d => d.Players[0].ObservedTeamIds = ["missing"],
        d => d.GamePlayerStats[0].TeamId = "c", d => d.Games[0].HomeScore = -1,
        d => d.TeamStats = [d.TeamStats[0], d.TeamStats[0]], d => d.Games = [null!], d => d.TeamStats[0].Statistics = null!
    }) { var invalid = Fixture(); mutate(invalid); await Write(invalid); await Error(503, async () => await service.Get(2026)); }
    var real = Path.Combine(Directory.GetCurrentDirectory(), "backend/GamePulse.Api/Data/processed/mls/seasons");
    if (Directory.Exists(real)) foreach (var file in Directory.GetFiles(real, "*.json"))
    {
        var imported = JsonSerializer.Deserialize<MlsSeason>(await File.ReadAllTextAsync(file), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        MlsDataService.Validate(imported, int.Parse(Path.GetFileNameWithoutExtension(file)));
        Check(imported.Games.All(g => g.Date.Length == 10), "Existing import validates: " + Path.GetFileName(file));
    }
    Console.WriteLine($"{count} MLS checks passed");
}
finally { Directory.Delete(root, true); }
sealed class TestEnvironment : IHostEnvironment
{
    public string EnvironmentName { get; set; } = "Development";
    public string ApplicationName { get; set; } = "MlsChecks";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
