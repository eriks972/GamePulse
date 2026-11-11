using GamePulse.Api.Models.Mls;

namespace GamePulse.Api.Services;

public static class MlsInsights
{
    public const string Method = "Calculated from imported completed matches with known scores. Verified 1996–1999 shootouts retain tied field scores, award the winner one point and the loser zero. Other unresolved shootouts remain excluded. Other regular-season wins earn 3 points and draws 1; sorted by points, goal difference, then goals scored. Not official MLS tiebreakers or playoff seeding. Imported statistics are season aggregates, not inferred match or player appearances. Missing observations remain unknown.";
    public sealed record Record(int ScheduledGames, int CompletedGames, int Games, int MissingScoreGames, int ExcludedShootoutGames,
        int Wins, int Draws, int Losses, int? Points, int? GoalsFor, int? GoalsAgainst, int? GoalDifference, double? GoalsPerGame, double? PointsPerGame);
    public sealed record Standing(MlsTeam Team, Record Record);

    public static string Phase(string phase)
    {
        if (!new[] { "Regular Season", "Playoffs", "Preseason", "Exhibition", "All-Star" }.Contains(phase))
            throw new MlsDataException(400, "Unknown MLS season type.");
        return phase;
    }
    private static bool ResolvedHistoricalShootout(MlsGame g) => g.Shootout && g.ShootoutWinPoints == 1 &&
        g.HomeScore.HasValue && g.HomeScore == g.AwayScore &&
        (g.ShootoutWinnerTeamId == g.HomeTeamId || g.ShootoutWinnerTeamId == g.AwayTeamId);
    public static Record Scores(IEnumerable<MlsGame> source, string teamId, string phase)
    {
        var all = source.Where(g => g.SeasonType == phase && (g.HomeTeamId == teamId || g.AwayTeamId == teamId)).ToArray();
        var finals = all.Where(g => g.Completed).ToArray();
        var scored = finals.Where(g => (!g.Shootout || ResolvedHistoricalShootout(g)) && g.HomeScore.HasValue && g.AwayScore.HasValue).ToArray();
        int wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, earnedPoints = 0;
        foreach (var g in scored)
        {
            var own = (g.HomeTeamId == teamId ? g.HomeScore : g.AwayScore)!.Value;
            var other = (g.HomeTeamId == teamId ? g.AwayScore : g.HomeScore)!.Value;
            goalsFor += own; goalsAgainst += other;
            if (g.Shootout)
            {
                if (g.ShootoutWinnerTeamId == teamId) { wins++; earnedPoints++; } else losses++;
            }
            else if (own > other) { wins++; earnedPoints += 3; }
            else if (own == other) { draws++; earnedPoints++; } else losses++;
        }
        int? points = phase == "Regular Season" && scored.Length > 0 ? earnedPoints : null;
        return new(all.Length, finals.Length, scored.Length, finals.Count(g => !g.HomeScore.HasValue || !g.AwayScore.HasValue), finals.Count(g => g.Shootout && !ResolvedHistoricalShootout(g)),
            wins, draws, losses, points, scored.Length > 0 ? goalsFor : null, scored.Length > 0 ? goalsAgainst : null,
            scored.Length > 0 ? goalsFor - goalsAgainst : null, scored.Length > 0 ? (double)goalsFor / scored.Length : null,
            points.HasValue ? (double)points / scored.Length : null);
    }
    public static Standing[] Standings(MlsSeason data) => data.Teams.Select(t => new Standing(t, Scores(data.Games, t.Id, "Regular Season")))
        .OrderByDescending(s => s.Record.Points).ThenByDescending(s => s.Record.GoalDifference).ThenByDescending(s => s.Record.GoalsFor)
        .ThenBy(s => s.Team.Name, StringComparer.Ordinal).ThenBy(s => s.Team.Id, StringComparer.Ordinal).ToArray();
    public static object Coverage(MlsSeason data) => new
    {
        season = data.Season, teams = data.Teams.Length, players = data.Players.Length,
        scheduleGames = data.Games.Length, completedGames = data.Games.Count(g => g.Completed),
        missingScoreGames = data.Games.Count(g => g.Completed && (!g.HomeScore.HasValue || !g.AwayScore.HasValue)),
        shootoutGames = data.Games.Count(g => g.Shootout), teamStatRows = data.TeamStats.Length, playerStatRows = data.PlayerStats.Length,
        teamsWithoutStatistics = data.Teams.Count(t => !data.TeamStats.Any(s => s.Id == t.Id)),
        playersWithoutStatistics = data.Players.Count(p => !data.PlayerStats.Any(s => s.Id == p.Id)),
        matchStatisticsAvailable = data.GameTeamStats.Length + data.GamePlayerStats.Length > 0,
        matchTeamStatRows = data.GameTeamStats.Length, matchPlayerStatRows = data.GamePlayerStats.Length,
        status = data.Teams.Length + data.Players.Length + data.Games.Length == 0 ? "unavailable" : "partial",
    };
    public static object TeamProfile(MlsSeason data, MlsTeam team, string phase) => new
    {
        team, record = Scores(data.Games, team.Id, phase),
        home = Scores(data.Games.Where(g => g.HomeTeamId == team.Id), team.Id, phase),
        away = Scores(data.Games.Where(g => g.AwayTeamId == team.Id), team.Id, phase),
        statistics = data.TeamStats.SingleOrDefault(s => s.Id == team.Id && s.SeasonType == phase),
    };
}

