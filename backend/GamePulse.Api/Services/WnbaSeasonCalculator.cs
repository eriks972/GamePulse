using GamePulse.Api.Models.Wnba;

namespace GamePulse.Api.Services;

// Pure calculations over a validated imported season. No extra data files or cache.
public static class WnbaSeasonCalculator
{
    public const string RankingMethod = "Calculated from valid completed regular-season scores. Equal win percentages share a rank; tied rows are alphabetical. Official tiebreakers are not applied.";
    public static readonly string[] StatisticKeys = ["points", "rebounds", "offensiveRebounds", "defensiveRebounds",
        "assists", "steals", "blocks", "turnovers", "fouls", "fieldGoalsMade", "fieldGoalsAttempted",
        "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "plusMinus", "minutes"];

    public static string NormalizeSeasonType(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        null or "" or "2" or "regular" or "regular-season" or "regular season" => "Regular Season",
        "3" or "playoffs" or "postseason" or "post-season" => "Playoffs",
        "1" or "preseason" or "pre-season" => "Preseason",
        "4" or "offseason" or "off-season" => "Offseason",
        _ => throw new WnbaDataException(400, "seasonType must be Regular Season, Playoffs, Preseason, or Offseason.")
    };

    private static bool HasFinalScore(WnbaGame game) => game.Completed == true &&
        game.HomeScore is double home && game.AwayScore is double away &&
        double.IsFinite(home) && double.IsFinite(away) && home >= 0 && away >= 0 &&
        home == Math.Truncate(home) && away == Math.Truncate(away) && home != away;

    public static WnbaStandings Standings(WnbaSeasonData data)
    {
        var scheduled = data.Games.Where(g => g.SeasonType.Equals("Regular Season", StringComparison.OrdinalIgnoreCase)).ToArray();
        var completed = scheduled.Where(g => g.Completed == true).ToArray();
        var counted = completed.Where(HasFinalScore).ToArray();
        var rows = data.Teams.Select(team =>
        {
            bool Involves(WnbaGame g) => g.HomeTeamId == team.Id || g.AwayTeamId == team.Id;
            var games = counted.Where(Involves).ToArray();
            var home = games.Where(g => g.HomeTeamId == team.Id).ToArray();
            var away = games.Where(g => g.AwayTeamId == team.Id).ToArray();
            var homeWins = home.Count(g => g.HomeScore > g.AwayScore);
            var awayWins = away.Count(g => g.AwayScore > g.HomeScore);
            return new WnbaStanding
            {
                TeamId = team.Id, Name = team.Name, Abbreviation = team.Abbreviation,
                ScheduledGames = scheduled.Count(Involves), CompletedGames = completed.Count(Involves), Games = games.Length,
                Wins = homeWins + awayWins, Losses = games.Length - homeWins - awayWins,
                HomeWins = homeWins, HomeLosses = home.Length - homeWins,
                AwayWins = awayWins, AwayLosses = away.Length - awayWins,
                PointsFor = games.Sum(g => (g.HomeTeamId == team.Id ? g.HomeScore : g.AwayScore)!.Value),
                PointsAgainst = games.Sum(g => (g.HomeTeamId == team.Id ? g.AwayScore : g.HomeScore)!.Value)
            };
        }).OrderByDescending(t => t.Games > 0 ? (decimal?)t.Wins / t.Games : null)
          .ThenBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ThenBy(t => t.TeamId, StringComparer.Ordinal).ToArray();
        foreach (var row in rows.Where(t => t.Games > 0))
            row.Rank = 1 + rows.Count(other => other.Games > 0 && (long)other.Wins * row.Games > (long)row.Wins * other.Games);
        return new(data.Season, "Regular Season", scheduled.Length, completed.Length, counted.Length,
            completed.Length - counted.Length, RankingMethod, rows);
    }

    public static WnbaSeasonStatistics TeamStatistics(WnbaSeasonData data, string? requestedType = null)
    {
        var type = NormalizeSeasonType(requestedType);
        var schedule = data.Games.Where(g => g.SeasonType.Equals(type, StringComparison.OrdinalIgnoreCase)).ToArray();
        var completed = schedule.Where(g => g.Completed == true).ToArray();
        // Use the schedule's season type and completion status, not a row's unverified label.
        var completedIds = completed.Select(g => g.Id).ToHashSet();
        var rows = data.TeamStatistics.Where(s => completedIds.Contains(s.GameId)).ToDictionary(s => (s.GameId, s.TeamId));
        var teams = data.Teams.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).Select(team =>
        {
            var games = completed.Where(g => g.HomeTeamId == team.Id || g.AwayTeamId == team.Id).ToArray();
            var own = games.Select(g => rows.GetValueOrDefault((g.Id, team.Id))).OfType<WnbaGameStat>().ToArray();
            var opponents = games.Select(g => rows.GetValueOrDefault((g.Id, g.HomeTeamId == team.Id ? g.AwayTeamId : g.HomeTeamId)))
                .OfType<WnbaGameStat>().ToArray();
            var discrepancies = games.Count(g => rows.TryGetValue((g.Id, team.Id), out var row) &&
                row.Statistics.GetValueOrDefault("points") is double points &&
                (g.HomeTeamId == team.Id ? g.HomeScore : g.AwayScore) is double score && points != score);
            return new WnbaTeamSeasonStatistics(data.Season, type, team.Id, team.Name, team.Abbreviation,
                schedule.Count(g => g.HomeTeamId == team.Id || g.AwayTeamId == team.Id), games.Length,
                own.Length, opponents.Length, discrepancies, Metrics(own), Metrics(opponents), Shooting(own), Shooting(opponents));
        }).ToArray();
        return new(data.Season, type, schedule.Length, completed.Length, teams);
    }

    private static Dictionary<string, WnbaSeasonMetric> Metrics(WnbaGameStat[] rows) => StatisticKeys.ToDictionary(key => key, key =>
    {
        var observed = rows.Select(row => row.Statistics.GetValueOrDefault(key)).OfType<double>().Where(double.IsFinite).ToArray();
        return observed.Length == 0 ? new WnbaSeasonMetric(null, null, 0) : new(observed.Sum(), observed.Average(), observed.Length);
    });

    private static Dictionary<string, WnbaShootingMetric> Shooting(WnbaGameStat[] rows)
    {
        var result = new Dictionary<string, WnbaShootingMetric>();
        foreach (var (name, madeKey, attemptedKey) in new[] {
            ("fieldGoals", "fieldGoalsMade", "fieldGoalsAttempted"),
            ("threePointers", "threePointersMade", "threePointersAttempted"),
            ("freeThrows", "freeThrowsMade", "freeThrowsAttempted") })
        {
            var pairs = rows.Select(r => (Made: r.Statistics.GetValueOrDefault(madeKey), Attempted: r.Statistics.GetValueOrDefault(attemptedKey)))
                .Where(p => p.Made.HasValue && p.Attempted.HasValue && double.IsFinite(p.Made.Value) && double.IsFinite(p.Attempted.Value) &&
                    p.Made >= 0 && p.Attempted >= p.Made).ToArray();
            double? made = pairs.Length == 0 ? null : pairs.Sum(p => p.Made!.Value);
            double? attempted = pairs.Length == 0 ? null : pairs.Sum(p => p.Attempted!.Value);
            result[name] = new(made, attempted, attempted > 0 ? made / attempted : null, pairs.Length);
        }
        return result;
    }
}
