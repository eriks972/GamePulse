namespace GamePulse.Api.Models.Wnba;

public sealed record WnbaComparisonTeam(WnbaTeam Team, WnbaStanding Record, WnbaTeamSeasonStatistics SeasonStatistics);
public sealed record WnbaHeadToHead(int ScheduledGames, int CompletedGames, int CountedGames,
    int ExcludedCompletedGames, int TeamAWins, int TeamBWins, WnbaGame[] Games);
public sealed record WnbaComparison(int Season, string SeasonType, WnbaComparisonTeam TeamA,
    WnbaComparisonTeam TeamB, WnbaHeadToHead HeadToHead);
