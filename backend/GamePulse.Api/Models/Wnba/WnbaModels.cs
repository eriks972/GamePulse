using System.Text.Json;

namespace GamePulse.Api.Models.Wnba;

public sealed class WnbaTeam
{
    public string Id { get; set; } = "";
    public string ExternalTeamId { get; set; } = "";
    public string League { get; set; } = "wnba";
    public string LeagueSlug => "wnba";
    public int Season { get; set; }
    public string? Name { get; set; }
    public string? Abbreviation { get; set; }
}

public sealed class WnbaPlayer
{
    public string Id { get; set; } = "";
    public string ExternalPlayerId { get; set; } = "";
    public string League { get; set; } = "wnba";
    public string LeagueSlug => "wnba";
    public int Season { get; set; }
    public string? FullName { get; set; }
    public string? Position { get; set; }
    public string[] TeamIds { get; set; } = [];
    public string[] RosterSnapshotTeamIds { get; set; } = [];
    public string[] Sources { get; set; } = [];
}

public sealed class WnbaGame
{
    public string Id { get; set; } = "";
    public string ExternalGameId { get; set; } = "";
    public string League { get; set; } = "wnba";
    public string LeagueSlug => "wnba";
    public int Season { get; set; }
    public string SeasonType { get; set; } = "Unknown";
    public string GameDate { get; set; } = "";
    public string HomeTeamId { get; set; } = "";
    public string AwayTeamId { get; set; } = "";
    public string HomeSourceId { get; set; } = "";
    public string AwaySourceId { get; set; } = "";
    public double? HomeScore { get; set; }
    public double? AwayScore { get; set; }
    public bool? Completed { get; set; }
    public string? Source { get; set; }
    public Dictionary<string, string> SourceIds { get; set; } = [];
    public JsonElement Coverage { get; set; }
    public string? HomeTeamName { get; set; }
    public string? HomeTeamAbbreviation { get; set; }
    public string? AwayTeamName { get; set; }
    public string? AwayTeamAbbreviation { get; set; }
    public string HomeExternalTeamId => HomeSourceId;
    public string AwayExternalTeamId => AwaySourceId;
    public string Status => Completed == true ? "Final" : Completed == false ? "Not final" : "Unknown";
}

public sealed class WnbaGameStat
{
    public string GameId { get; set; } = "";
    public string TeamId { get; set; } = "";
    public string? PlayerId { get; set; }
    public int Season { get; set; }
    public string SeasonType { get; set; } = "Unknown";
    public Dictionary<string, double?> Statistics { get; set; } = [];
    public Dictionary<string, string> StatSources { get; set; } = [];
    public string[] Sources { get; set; } = [];
}

public sealed record WnbaSeasonData(
    int Season,
    WnbaTeam[] Teams,
    WnbaPlayer[] Players,
    WnbaGame[] Games,
    WnbaGameStat[] TeamStatistics,
    WnbaGameStat[] PlayerStatistics,
    JsonElement Coverage);
