using System.Text.Json;

namespace GamePulse.Api.Models.Nfl;

public sealed record NflFile(string Path, string Encoding, int Count, long Bytes, string Sha256);
public sealed record NflManifest(int SchemaVersion, string League, int Season, string RunId,
    DateTimeOffset GeneratedAtUtc, Dictionary<string, NflFile> Files, JsonElement Coverage);
public sealed record NflEnvelope<T>(int SchemaVersion, string League, int Season, int Count, T[] Data);
public sealed record NflGame(string GameId, int Season, string SeasonType, string Round, int Week,
    string Date, DateTimeOffset? KickoffUtc, string HomeTeamId, string AwayTeamId,
    int? HomeScore, int? AwayScore, string Status, string? Stadium);
public sealed record NflTeam(string TeamId, string? SourceTeamId, string Name, string? Conference,
    string? Division, string? Color, string? LogoUrl);
public sealed record NflPlayer(string PlayerId, string Name, string? Position, string[] TeamIds,
    string? EspnId, string? HeadshotUrl);
public sealed record NflRoster(int Season, string TeamId, string? PlayerId, string? Name,
    string? Position, int? JerseyNumber, string? Status);
public sealed record NflStat(int Season, string SeasonType, int Week, string GameId, string TeamId,
    string OpponentTeamId, JsonElement Stats, string? PlayerId, string? Name, string? Position);
public sealed record NflRecord(string TeamId, string SeasonType, int Wins, int Losses, int Ties,
    int Played, int PointsFor, int PointsAgainst);
public sealed record NflPage<T>(T[] Items, int Total, int Page, int PageSize);
public sealed class NflDataException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
