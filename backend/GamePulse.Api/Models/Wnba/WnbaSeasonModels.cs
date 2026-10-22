namespace GamePulse.Api.Models.Wnba;

public sealed class WnbaStanding
{
    public string TeamId { get; init; } = "";
    public string? Name { get; init; }
    public string? Abbreviation { get; init; }
    public int? Rank { get; set; }
    public int ScheduledGames { get; init; }
    public int CompletedGames { get; init; }
    public int Games { get; init; }
    public int ExcludedCompletedGames => CompletedGames - Games;
    public int Wins { get; init; }
    public int Losses { get; init; }
    public double? WinPercentage => Games > 0 ? (double)Wins / Games : null;
    public int HomeWins { get; init; }
    public int HomeLosses { get; init; }
    public int AwayWins { get; init; }
    public int AwayLosses { get; init; }
    public double PointsFor { get; init; }
    public double PointsAgainst { get; init; }
    public double PointDifferential => PointsFor - PointsAgainst;
    public double? PointsPerGame => Games > 0 ? PointsFor / Games : null;
    public double? OpponentPointsPerGame => Games > 0 ? PointsAgainst / Games : null;
    public double? ScoringMargin => Games > 0 ? PointDifferential / Games : null;
}

public sealed record WnbaStandings(int Season, string SeasonType, int ScheduledGames,
    int CompletedGames, int CountedGames, int ExcludedCompletedGames, string RankingMethod, WnbaStanding[] Teams);

public sealed record WnbaSeasonMetric(double? Total, double? PerGame, int Games);
public sealed record WnbaShootingMetric(double? Made, double? Attempted, double? Percentage, int Games);
public sealed record WnbaTeamSeasonStatistics(int Season, string SeasonType, string TeamId,
    string? Name, string? Abbreviation, int ScheduledGames, int CompletedGames,
    int TeamStatsGames, int OpponentStatsGames, int ScoreDiscrepancyGames,
    Dictionary<string, WnbaSeasonMetric> Statistics, Dictionary<string, WnbaSeasonMetric> OpponentStatistics,
    Dictionary<string, WnbaShootingMetric> Shooting, Dictionary<string, WnbaShootingMetric> OpponentShooting);
public sealed record WnbaSeasonStatistics(int Season, string SeasonType, int ScheduledGames,
    int CompletedGames, WnbaTeamSeasonStatistics[] Teams);
