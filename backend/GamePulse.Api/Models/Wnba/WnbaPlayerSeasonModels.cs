namespace GamePulse.Api.Models.Wnba;

public sealed record WnbaPlayerSeasonStatistics(int Season, string SeasonType, string PlayerId,
    string? Name, string? Position, string[] TeamIds, string? TeamScopeId, int Games,
    int ExcludedAmbiguousGames, Dictionary<string, WnbaSeasonMetric> Statistics,
    Dictionary<string, WnbaShootingMetric> Shooting)
{
    public int? Rank { get; set; }
}

public sealed record WnbaPlayerLeaderboard(int Season, string SeasonType, string? TeamScopeId,
    string Metric, string Basis, bool IsShootingPercentage, int MinGames, int MinAttempts,
    int CompletedScheduleGames, int PlayersWithStatistics, int QualifyingPlayers,
    string RankingMethod, WnbaPlayerSeasonStatistics[] Players);
