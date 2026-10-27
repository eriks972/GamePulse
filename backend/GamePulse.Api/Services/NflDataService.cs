using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using GamePulse.Api.Models.Nfl;

namespace GamePulse.Api.Services;

// One cached season/run. Requests already in progress retain their immutable snapshot.
// Each compressed dataset is loaded only when a route needs it; nothing is extracted to disk.
public sealed class NflSnapshot(NflManifest manifest, string identity)
{
    public NflManifest Manifest { get; } = manifest;
    internal string Identity { get; } = identity;
    internal SemaphoreSlim Gate { get; } = new(1, 1);
    internal Dictionary<string, object> Datasets { get; } = [];
}

public sealed class NflDataService(IWebHostEnvironment env, ILogger<NflDataService> logger)
{
    private readonly string root = Path.Combine(env.ContentRootPath, "Data", "processed", "nfl");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] Keys = ["games", "teams", "players", "rosters", "records", "team_stats", "player_stats", "unassigned_stats"];
    private readonly SemaphoreSlim gate = new(1, 1);
    private NflSnapshot? cached;

    private async Task<T> Guard<T>(Func<Task<T>> action)
    {
        try { return await action(); }
        catch (Exception e) when (e is IOException or JsonException or InvalidDataException or UnauthorizedAccessException or FormatException or ArgumentException)
        {
            logger.LogError(e, "NFL snapshot could not be read");
            throw new NflDataException(503, "NFL data is temporarily unavailable. Check the published snapshot.");
        }
    }

    private async Task<(NflManifest Manifest, string Identity)> Manifest(int year, CancellationToken ct)
    {
        var path = Path.Combine(root, "seasons", year.ToString(System.Globalization.CultureInfo.InvariantCulture), "current.json");
        if (!File.Exists(path)) throw new NflDataException(404, "NFL season has not been imported.");
        var bytes = await File.ReadAllBytesAsync(path, ct);
        var m = JsonSerializer.Deserialize<NflManifest>(bytes, Json) ?? throw new InvalidDataException("Empty NFL manifest.");
        if (m.SchemaVersion != 1 || m.League != "NFL" || m.Season != year ||
            m.RunId is null || !Regex.IsMatch(m.RunId, @"^\d{8}T\d{6}-[a-f0-9]{8}$") ||
            m.GeneratedAtUtc == default || m.Files is null || m.Coverage.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException("Invalid NFL manifest.");
        foreach (var key in Keys)
        {
            if (!m.Files.TryGetValue(key, out var f) || f is null ||
                f.Path != $"seasons/{year}/runs/{m.RunId}/{key}.json.gz" || f.Encoding != "gzip" ||
                f.Count < 0 || f.Bytes < 0 || f.Sha256 is null || !Regex.IsMatch(f.Sha256, "^[a-fA-F0-9]{64}$") ||
                !File.Exists(Path.Combine(root, f.Path)))
                throw new InvalidDataException($"Missing or invalid NFL dataset {key}.");
        }
        return (m, Convert.ToHexString(SHA256.HashData(bytes)));
    }

    // Authoritative per-season pointers also recover a season omitted by a stale index.
    public Task<NflManifest[]> Seasons(CancellationToken ct) => Guard(async () =>
    {
        var dir = Path.Combine(root, "seasons");
        if (!Directory.Exists(dir)) return [];
        var result = new List<NflManifest>();
        foreach (var folder in Directory.EnumerateDirectories(dir).OrderDescending())
        {
            if (!int.TryParse(Path.GetFileName(folder), out var year) || year < 1999 || year > 2100 ||
                !File.Exists(Path.Combine(folder, "current.json"))) continue;
            result.Add((await Manifest(year, ct)).Manifest);
        }
        return result.OrderByDescending(m => m.Season).ToArray();
    });

    public Task<NflSnapshot> Season(int? year, CancellationToken ct) => Guard(async () =>
    {
        if (year is < 1999 or > 2100) throw new NflDataException(400, "Use an NFL season between 1999 and 2100.");
        var selected = year ?? (await Seasons(ct)).FirstOrDefault()?.Season ?? throw new NflDataException(404, "No NFL seasons have been imported.");
        var (m, identity) = await Manifest(selected, ct);
        await gate.WaitAsync(ct);
        try
        {
            if (cached?.Identity != identity) cached = new NflSnapshot(m, identity);
            return cached;
        }
        finally { gate.Release(); }
    });

    public Task<T[]> Read<T>(NflSnapshot snapshot, string key, CancellationToken ct) => Guard(async () =>
    {
        await snapshot.Gate.WaitAsync(ct);
        try
        {
            if (snapshot.Datasets.TryGetValue(key, out var value)) return (T[])value;
            var f = snapshot.Manifest.Files[key];
            await using var file = File.OpenRead(Path.Combine(root, f.Path));
            if (file.Length != f.Bytes || !Convert.ToHexString(await SHA256.HashDataAsync(file, ct)).Equals(f.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("NFL checksum mismatch.");
            file.Position = 0;
            await using var gzip = new GZipStream(file, CompressionMode.Decompress);
            var envelope = await JsonSerializer.DeserializeAsync<NflEnvelope<T>>(gzip, Json, ct);
            if (envelope is null || envelope.SchemaVersion != 1 || envelope.League != "NFL" ||
                envelope.Season != snapshot.Manifest.Season || envelope.Data is null ||
                envelope.Count != f.Count || envelope.Data.Length != f.Count || envelope.Data.Any(x => x is null))
                throw new InvalidDataException("Invalid NFL dataset envelope.");
            snapshot.Datasets[key] = envelope.Data;
            return envelope.Data;
        }
        finally { snapshot.Gate.Release(); }
    });
}
