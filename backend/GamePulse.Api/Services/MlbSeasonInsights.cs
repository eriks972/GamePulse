using GamePulse.Api.Models.Mlb;
namespace GamePulse.Api.Services;

// Read-only views over existing season summaries and scored games.
public static class MlbSeasonInsights
{
    public const string Method = "Imported observations only; unknown fields remain null. Rates use component totals, and IP uses innings and outs. Missing appearances or game files can make totals incomplete. Regular season and playoffs stay separate; cross-season comparisons are unadjusted for era, park, or schedule length.";
    public static string Phase(string value)
    {
        if (!new[] { "Regular Season", "Playoffs", "Preseason", "Exhibition", "All-Star" }.Contains(value))
            throw new MlbDataException(400, "Unknown MLB season type.");
        return value;
    }
    public sealed record ScoreSplit(string Label, int ScheduledGames, int CompletedGames, int ScoredGames,
        int Wins, int Losses, int Ties, double? WinPercentage, long? RunsFor, long? RunsAgainst,
        long? RunDifferential, double? RunsPerGame, int MissingScoreGames);
    public sealed record PlayerProfile(int Season, string SeasonType, MlbPlayer Player, MlbTeam? SelectedTeam,
        MlbBattingRow? Batting, MlbPitchingRow? Pitching, MlbBattingRow[] BattingTeams,
        MlbPitchingRow[] PitchingTeams, MlbTeam[] Teams, System.Text.Json.JsonElement Coverage, string Method);
    public sealed record TeamProfile(int Season, string SeasonType, MlbTeam Team, ScoreSplit Record,
        ScoreSplit[] HomeAway, ScoreSplit[] Months, MlbBattingRow? Batting, MlbPitchingRow? Pitching,
        int MissingBattingGames, int MissingPitchingGames, string Method);

    public static PlayerProfile Player(MlbSeasonData data, MlbPlayer player, MlbBattingFile batting,
        MlbPitchingFile pitching, string phase, MlbTeam? team = null)
    {
        Phase(phase);
        var bat = batting.Rows.Where(r => r.Kind == "player" && r.Id == player.Id && r.SeasonType == phase).ToArray();
        var pit = pitching.Rows.Where(r => r.Kind == "player" && r.Id == player.Id && r.SeasonType == phase).ToArray();
        return new(data.Season, phase, player, team, bat.SingleOrDefault(r => r.TeamId == team?.Id),
            pit.SingleOrDefault(r => r.TeamId == team?.Id), bat.Where(r => r.TeamId != null).ToArray(),
            pit.Where(r => r.TeamId != null).ToArray(), data.Teams, data.Coverage, Method);
    }
    public static ScoreSplit Scores(string label, IEnumerable<MlbGame> source, string teamId)
    {
        var scheduled = source.ToArray();
        var completed = scheduled.Where(g => g.Completed).ToArray();
        var scored = completed.Where(g => g.HomeScore.HasValue && g.AwayScore.HasValue).ToArray();
        long Own(MlbGame g) => (g.HomeTeamId == teamId ? g.HomeScore : g.AwayScore)!.Value;
        long Opp(MlbGame g) => (g.HomeTeamId == teamId ? g.AwayScore : g.HomeScore)!.Value;
        var wins = scored.Count(g => Own(g) > Opp(g));
        var losses = scored.Count(g => Own(g) < Opp(g));
        var known = completed.Length > 0 && scored.Length == completed.Length;
        long? rf = known ? scored.Sum(Own) : null, ra = known ? scored.Sum(Opp) : null;
        return new(label, scheduled.Length, completed.Length, scored.Length, wins, losses,
            scored.Count(g => Own(g) == Opp(g)), wins + losses > 0 ? (double)wins / (wins + losses) : null,
            rf, ra, rf - ra, known ? (double)rf!.Value / completed.Length : null, completed.Length - scored.Length);
    }
    public static TeamProfile Team(MlbSeasonData data, MlbTeam team, MlbBattingFile batting, MlbPitchingFile pitching, string phase)
    {
        Phase(phase);
        var games = data.Games.Where(g => g.SeasonType == phase && (g.HomeTeamId == team.Id || g.AwayTeamId == team.Id)).ToArray();
        var record = Scores("Season", games, team.Id);
        var bat = batting.Rows.SingleOrDefault(r => r.Kind == "team" && r.Id == team.Id && r.SeasonType == phase);
        var pit = pitching.Rows.SingleOrDefault(r => r.Kind == "team" && r.Id == team.Id && r.SeasonType == phase);
        return new(data.Season, phase, team, record,
            [Scores("Home", games.Where(g => g.HomeTeamId == team.Id), team.Id), Scores("Away", games.Where(g => g.AwayTeamId == team.Id), team.Id)],
            games.GroupBy(g => g.OfficialDate[..7]).OrderBy(g => g.Key).Select(g => Scores(g.Key, g, team.Id)).ToArray(),
            bat, pit, Math.Max(0, record.CompletedGames - (bat?.Games ?? 0)), Math.Max(0, record.CompletedGames - (pit?.Games ?? 0)), Method);
    }
    public static Dictionary<string, double?> Differences(PlayerProfile left, PlayerProfile right, string group)
    {
        if (group is not ("batting" or "pitching")) throw new MlbDataException(400, "group must be batting or pitching.");
        var result = new Dictionary<string, double?>();
        if (group == "batting")
        {
            foreach (var k in MlbBattingLeaderboard.Counts) result[k] = (double?)left.Batting?.Totals.GetValueOrDefault(k) - right.Batting?.Totals.GetValueOrDefault(k);
            foreach (var k in MlbBattingLeaderboard.Rates) result[k] = left.Batting?.Rates.GetValueOrDefault(k) - right.Batting?.Rates.GetValueOrDefault(k);
        }
        else
        {
            foreach (var k in MlbPitchingLeaderboard.Counts) result[k] = (double?)left.Pitching?.Totals.GetValueOrDefault(k) - right.Pitching?.Totals.GetValueOrDefault(k);
            foreach (var k in MlbPitchingLeaderboard.Rates) result[k] = left.Pitching?.Rates.GetValueOrDefault(k) - right.Pitching?.Rates.GetValueOrDefault(k);
        }
        return result;
    }
}
