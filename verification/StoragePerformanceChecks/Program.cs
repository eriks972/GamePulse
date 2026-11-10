using System.Text.Json;
using GamePulse.Api.Models.Mlb;
using GamePulse.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

var checks = 0;
void Check(bool condition, string name) { if (!condition) throw new Exception(name); Console.WriteLine($"PASS {++checks}: {name}"); }
var root = Path.Combine(Path.GetTempPath(), "gamepulse-performance-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
try
{
    using var service = new MlbJsonDataService(new TestEnvironment(root), new ConfigurationBuilder().Build(), NullLogger<MlbJsonDataService>.Instance);
    var first = Path.Combine(root, "first"); Directory.CreateDirectory(first);
    void Write(string dir, string name, int version = 1, int year = 2025) => File.WriteAllText(Path.Combine(dir, name + ".json"), JsonSerializer.Serialize(new { version, season = year, rows = Array.Empty<object>() }));
    MlbSeasonData Data(string dir, int year = 2025) => new(year, dir, [], [], [], [], JsonSerializer.SerializeToElement(new { season = year }));
    var snapshot = Data(first);
    Write(first, "batting"); Write(first, "pitching");
    var batting = await service.GetBattingAsync(snapshot);
    var pitching = await service.GetPitchingAsync(snapshot);
    // Removing the fixture proves warm reads do not reopen/decompress a file.
    File.Delete(Path.Combine(first, "batting.json")); File.Delete(Path.Combine(first, "pitching.json"));
    Check(ReferenceEquals(batting, await service.GetBattingAsync(snapshot)), "batting summary reused without disk read");
    Check(ReferenceEquals(pitching, await service.GetPitchingAsync(snapshot)), "pitching summary reused without disk read");
    var concurrent = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => service.GetBattingAsync(snapshot)));
    Check(concurrent.All(x => ReferenceEquals(batting, x)), "concurrent warm requests share validated summary");
    var next = Path.Combine(root, "second"); Directory.CreateDirectory(next); Write(next, "batting", year: 2026);
    Check((await service.GetBattingAsync(Data(next, 2026))).Season == 2026, "different season remains independent");
    Write(next, "batting"); var imported = Data(next);
    Check(!ReferenceEquals(batting, await service.GetBattingAsync(imported)), "new snapshot does not reuse previous summary");
    Write(first, "batting", version: 99); var invalid = Data(first);
    try { await service.GetBattingAsync(invalid); throw new Exception("invalid data accepted"); } catch (MlbDataException e) { Check(e.StatusCode == 503, "invalid batting summary rejected"); }
    Write(first, "batting"); Check((await service.GetBattingAsync(invalid)).Version == 1, "failed summary is retryable after repair");
    Write(first, "pitching", version: 99); var invalidPitching = Data(first);
    try { await service.GetPitchingAsync(invalidPitching); throw new Exception("invalid data accepted"); } catch (MlbDataException e) { Check(e.StatusCode == 503, "invalid pitching summary rejected"); }
    Write(first, "pitching"); Check((await service.GetPitchingAsync(invalidPitching)).Version == 1, "failed pitching summary is retryable");
    var cold = Data(first);
    var coldLoads = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => service.GetBattingAsync(cold)));
    Check(coldLoads.All(x => ReferenceEquals(coldLoads[0], x)), "concurrent cold requests load once");
    using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
    try { await service.GetBattingAsync(Data(first), cancelled.Token); throw new Exception("cancellation ignored"); } catch (OperationCanceledException) { Check(true, "cancelled read propagates cancellation"); }
    Check((await service.GetBattingAsync(Data(first))).Version == 1, "cancelled request does not block later reads");
    // NBA methods keep their public results while avoiding full UTF-16 file strings.
    var nbaRoot = Path.Combine(root, "Data", "processed"); Directory.CreateDirectory(nbaRoot);
    File.WriteAllText(Path.Combine(nbaRoot, "teams.json"), "[{\"externalTeamId\":1,\"name\":\"Example\"}]");
    File.WriteAllText(Path.Combine(nbaRoot, "players.json"), "[]"); File.WriteAllText(Path.Combine(nbaRoot, "seasons.json"), "[\"2022\"]");
    File.WriteAllText(Path.Combine(nbaRoot, "standings_by_season.json"), "{\"2022\":[{\"externalTeamId\":1,\"wins\":2,\"losses\":1}]}");
    File.WriteAllText(Path.Combine(nbaRoot, "team_stats_by_season.json"), "{\"2022\":[]}");
    var nba = new NbaJsonDataService(new TestEnvironment(root));
    Check((await nba.GetTeamsAsync()).Single().Name == "Example", "streamed NBA teams preserve mapping");
    Check((await nba.GetPlayersAsync()).Count == 0, "streamed NBA player list");
    Check((await nba.GetSeasonsAsync()).Single() == "2022", "streamed NBA season index");
    Check((await nba.GetStandingsAsync("2022")).Single().Wins == 2, "streamed NBA standings");
    Check((await nba.GetTeamStatsAsync("2022")).Count == 0, "streamed NBA statistics");
}
finally { Directory.Delete(root, recursive: true); }
Console.WriteLine($"{checks} storage/performance service checks passed");

sealed class TestEnvironment(string root) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = "Production";
    public string ApplicationName { get; set; } = "StorageChecks";
    public string ContentRootPath { get; set; } = root;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
