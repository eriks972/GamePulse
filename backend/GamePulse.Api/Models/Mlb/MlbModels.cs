using System.Text.Json;
namespace GamePulse.Api.Models.Mlb;

public sealed class MlbGroup { public string? Id { get; set; } public string? Name { get; set; } }
public sealed class MlbTeam
{
    public string Id { get; set; } = ""; public string SourceId { get; set; } = ""; public int Season { get; set; }
    public string? Name { get; set; } public string? Abbreviation { get; set; }
    public MlbGroup? League { get; set; } public MlbGroup? Division { get; set; } public MlbGroup? Venue { get; set; }
}
public sealed class MlbPlayer
{
    public string Id { get; set; } = ""; public string SourceId { get; set; } = ""; public int Season { get; set; }
    public string? FullName { get; set; } public string? Position { get; set; } public string? BatSide { get; set; } public string? PitchHand { get; set; }
    public string[] TeamIds { get; set; } = []; public string[] RosterSnapshotTeamIds { get; set; } = []; public string[] GameIds { get; set; } = [];
}
public sealed class MlbGameCoverage
{ public int TeamGroupRows { get; set; } public int PlayerGroupRows { get; set; } public int InningRows { get; set; } }
public sealed class MlbGame
{
    public string Id { get; set; } = ""; public string SourceId { get; set; } = ""; public int Season { get; set; }
    public string SeasonType { get; set; } = "Unknown"; public string? GameType { get; set; }
    public string? GameDate { get; set; } public string OfficialDate { get; set; } = ""; public string? Status { get; set; } public bool Completed { get; set; }
    public string HomeTeamId { get; set; } = ""; public string AwayTeamId { get; set; } = "";
    public string? HomeTeamName { get; set; } public string? AwayTeamName { get; set; }
    public int? HomeScore { get; set; } public int? AwayScore { get; set; } public int? GameNumber { get; set; } public string? DoubleHeader { get; set; }
    public MlbGameCoverage Coverage { get; set; } = new();
}
public sealed class MlbGameStat
{
    public string GameId { get; set; } = ""; public string TeamId { get; set; } = ""; public string OpponentTeamId { get; set; } = "";
    public string? PlayerId { get; set; } public int Season { get; set; } public string SeasonType { get; set; } = "Unknown";
    public string Group { get; set; } = ""; public string? Source { get; set; } public Dictionary<string, JsonElement> Statistics { get; set; } = [];
}
public sealed class MlbInning
{
    public string GameId { get; set; } = ""; public string TeamId { get; set; } = ""; public int Inning { get; set; }
    public int? Runs { get; set; } public int? Hits { get; set; } public int? Errors { get; set; } public int? LeftOnBase { get; set; } public string? Source { get; set; }
}
public sealed class MlbGameFile
{
    public MlbGameStat[] TeamStatistics { get; set; } = []; public MlbGameStat[] PlayerStatistics { get; set; } = []; public MlbInning[] LineScores { get; set; } = [];
}
public sealed class MlbProviderStanding
{
    public int Season { get; set; } public string TeamId { get; set; } = ""; public int? Wins { get; set; } public int? Losses { get; set; }
    public string? WinningPercentage { get; set; } public string? GamesBack { get; set; } public string? DivisionRank { get; set; }
}
public sealed record MlbSeasonData(int Season, string Directory, MlbTeam[] Teams, MlbPlayer[] Players, MlbGame[] Games, MlbProviderStanding[] ProviderStandings, JsonElement Coverage);
public sealed record MlbPage<T>(T[] Items, int Total, int Page, int PageSize);
public sealed record MlbStanding(MlbTeam Team, int ScheduledGames, int CompletedGames, int Games, int ExcludedCompletedGames,
    int Wins, int Losses, int Ties, double? WinPercentage, int RunsFor, int RunsAgainst);
