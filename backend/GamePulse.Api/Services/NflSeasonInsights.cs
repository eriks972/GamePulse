using GamePulse.Api.Models.Nfl;
namespace GamePulse.Api.Services;

public static class NflSeasonInsights
{
    public const string Method = "Imported observations only. Totals and rates use the same calculations as NFL Leaders. Missing fields keep their totals and dependent rates unknown; missing appearances are not inferred. Regular season and postseason stay separate. Home/away follows schedule designations, including neutral-site games. Opponent production uses the opposing team rows, not sums of player records. Comparisons are unadjusted for era, schedule length, or opportunity volume.";
    public static string Phase(string phase) => phase is "REG" or "POST" ? phase : throw new NflDataException(400, "Use REG or POST for NFL season insights.");
    public static string Group(string group) => NflLeaderboards.Definitions.ContainsKey(group) ? group : throw new NflDataException(400, "Choose passing, rushing, or receiving.");
    private static readonly Dictionary<string, string> Metrics = new() { ["passing"] = "passing_yards", ["rushing"] = "rushing_yards", ["receiving"] = "receiving_yards" };
    private static NflLeader? Unranked(NflLeader? row) => row is null ? null : row with { Rank = null, Value = null };
    public sealed record PlayerProfile(int Season, string SeasonType, NflPlayer Player, string? TeamId,
        Dictionary<string,NflLeader?> Groups, Dictionary<string,NflLeader?> AllTeamGroups,
        NflTeam[] Teams, System.Text.Json.JsonElement Coverage, string Method);
    public sealed record ScoreSplit(string Label, int ScheduledGames, int CompletedGames, int ScoredGames,
        int Wins, int Losses, int Ties, double? WinPercentage, long? PointsFor, long? PointsAgainst,
        long? Differential, double? PointsPerGame, int MissingScoreGames);
    public sealed record WeekSplit(int Week, string Round, ScoreSplit Record);
    public sealed record TeamProfile(int Season, string SeasonType, NflTeam Team, ScoreSplit Record,
        Dictionary<string,NflLeader?> Offense, Dictionary<string,NflLeader?> Opponents,
        int ObservedTeamGames, int ObservedOpponentGames, int MissingTeamGames, int MissingOpponentGames,
        ScoreSplit[] HomeAway, WeekSplit[] Weeks);

    public static PlayerProfile Profile(int season, NflPlayer player, NflTeam[] teams, NflGame[] games,
        NflStat[] source, System.Text.Json.JsonElement coverage, string phase, string? team)
    {
        Phase(phase);
        var rows = source.Where(r => r.PlayerId == player.PlayerId).ToArray();
        Dictionary<string,NflLeader?> Groups(string? selected) => NflLeaderboards.Definitions.Keys.ToDictionary(k => k,
            k => Unranked(NflLeaderboards.Calculate(rows, games, [player], k, phase, Metrics[k], selected, null, 0).SingleOrDefault()));
        var all = Groups(null);
        return new(season, phase, player, team, team is null ? all : Groups(team), all, teams, coverage, Method);
    }
    public static ScoreSplit Scores(string label, IEnumerable<NflGame> source, string team)
    {
        var games = source.ToArray(); var final = games.Where(g => g.Status == "final").ToArray();
        var scored = final.Where(g => g.HomeScore.HasValue && g.AwayScore.HasValue).ToArray();
        long Own(NflGame g) => (g.HomeTeamId == team ? g.HomeScore : g.AwayScore)!.Value;
        long Opp(NflGame g) => (g.HomeTeamId == team ? g.AwayScore : g.HomeScore)!.Value;
        var wins = scored.Count(g => Own(g) > Opp(g)); var losses = scored.Count(g => Own(g) < Opp(g));
        var ties = scored.Count(g => Own(g) == Opp(g)); var complete = final.Length > 0 && final.Length == scored.Length;
        long? pf = complete ? scored.Sum(Own) : null, pa = complete ? scored.Sum(Opp) : null;
        return new(label, games.Length, final.Length, scored.Length, wins, losses, ties,
            scored.Length > 0 ? (wins + ties / 2.0) / scored.Length : null, pf, pa, pf - pa,
            complete ? (double)pf!.Value / final.Length : null, final.Length - scored.Length);
    }
    public static TeamProfile[] Teams(int season, NflTeam[] teams, NflGame[] games, NflStat[] rows, string phase)
    {
        Phase(phase);
        // Reuse leader aggregation and relationship validation. Team identities replace
        // player identities only in these temporary rows; stored data is never changed.
        var identities = teams.Select(t => new NflPlayer(t.TeamId, t.Name, null, [t.TeamId], null, null)).ToArray();
        var forward = rows.Select(r => r with { PlayerId = r.TeamId }).ToArray();
        var reverse = rows.Select(r => r with { PlayerId = r.OpponentTeamId }).ToArray();
        var own = Metrics.ToDictionary(p => p.Key, p => NflLeaderboards.Calculate(forward, games, identities, p.Key, phase, p.Value, null, null, 0));
        var opposing = Metrics.ToDictionary(p => p.Key, p => NflLeaderboards.Calculate(reverse, games, identities, p.Key, phase, p.Value, null, null, 0));
        var final = games.Where(g => g.SeasonType == phase && g.Status == "final").Select(g => g.GameId).ToHashSet();
        return teams.OrderBy(t => t.Name).Select(t =>
        {
            var selected = games.Where(g => g.SeasonType == phase && (g.HomeTeamId == t.TeamId || g.AwayTeamId == t.TeamId)).ToArray();
            var record = Scores("Season", selected, t.TeamId);
            var observed = rows.Where(r => r.SeasonType == phase && r.TeamId == t.TeamId && final.Contains(r.GameId)).Select(r => r.GameId).Distinct().Count();
            var observedOpp = rows.Where(r => r.SeasonType == phase && r.OpponentTeamId == t.TeamId && final.Contains(r.GameId)).Select(r => r.GameId).Distinct().Count();
            return new TeamProfile(season, phase, t, record,
                own.ToDictionary(p => p.Key, p => Unranked(p.Value.SingleOrDefault(r => r.PlayerId == t.TeamId))),
                opposing.ToDictionary(p => p.Key, p => Unranked(p.Value.SingleOrDefault(r => r.PlayerId == t.TeamId))),
                observed, observedOpp, Math.Max(0, record.CompletedGames - observed), Math.Max(0, record.CompletedGames - observedOpp),
                [Scores("Designated home", selected.Where(g => g.HomeTeamId == t.TeamId), t.TeamId), Scores("Designated away", selected.Where(g => g.AwayTeamId == t.TeamId), t.TeamId)],
                selected.GroupBy(g => g.Week).OrderBy(g => g.Key).Select(g => new WeekSplit(g.Key, g.First().Round, Scores("Week " + g.Key, g, t.TeamId))).ToArray());
        }).ToArray();
    }
    public static Dictionary<string,double?> Differences(PlayerProfile left, PlayerProfile right, string group)
    {
        Group(group); var a = left.Groups[group]; var b = right.Groups[group];
        double? Value(NflLeader? row, string key) => row is null ? null : row.Totals.TryGetValue(key, out var n) ? n : row.Rates.GetValueOrDefault(key);
        var d = NflLeaderboards.Definitions[group];
        return d.Counts.Concat(d.Rates).ToDictionary(k => k, k => Value(a,k) - Value(b,k));
    }
}
