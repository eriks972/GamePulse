using GamePulse.Api.Models.Wnba;

namespace GamePulse.Api.Services;

public static class WnbaPlayerSeasonCalculator
{
    private static readonly HashSet<string> ShootingMetrics = ["fieldGoals", "threePointers", "freeThrows"];
    public const string RankingMethod = "Calculated leaders, highest value first; exact ties share rank and appear alphabetically. Cutoffs apply to observed games for the selected statistic, not official league qualification. Search preserves ranks within the selected team and cutoffs.";

    public static WnbaPlayerSeasonStatistics[] Statistics(WnbaSeasonData data, string? requestedType = null, string? teamId = null)
    {
        var type = WnbaSeasonCalculator.NormalizeSeasonType(requestedType);
        var completed = data.Games.Where(g => g.Completed == true && g.SeasonType.Equals(type, StringComparison.OrdinalIgnoreCase))
            .Select(g => g.Id).ToHashSet();
        // Resolve ambiguous player/game observations before applying a team filter.
        // The same player cannot participate for both sides of the same game.
        var groups = data.PlayerStatistics.Where(r => completed.Contains(r.GameId))
            .GroupBy(r => (r.PlayerId, r.GameId)).Select(g => g.ToArray()).ToArray();
        var valid = groups.Where(g => g.Length == 1).Select(g => g[0]).Where(r => teamId is null || r.TeamId == teamId)
            .ToLookup(r => r.PlayerId);
        var ambiguous = groups.Where(g => g.Length != 1 && (teamId is null || g.Any(r => r.TeamId == teamId)))
            .ToLookup(g => g[0].PlayerId);
        return data.Players.Select(player =>
        {
            var rows = valid[player.Id].ToArray();
            return new WnbaPlayerSeasonStatistics(data.Season, type, player.Id, player.FullName, player.Position,
                rows.Select(r => r.TeamId).Distinct().Order(StringComparer.Ordinal).ToArray(), teamId, rows.Length,
                ambiguous[player.Id].Count(), WnbaSeasonCalculator.Metrics(rows), WnbaSeasonCalculator.Shooting(rows));
        }).ToArray();
    }

    public static WnbaPlayerLeaderboard Leaders(WnbaSeasonData data, string? requestedType = null, string? teamId = null,
        string metric = "points", string basis = "perGame", int minGames = 1, int minAttempts = 0, string? search = null)
    {
        if (!WnbaSeasonCalculator.StatisticKeys.Contains(metric) && !ShootingMetrics.Contains(metric))
            throw new WnbaDataException(400, "Unknown player statistic metric.");
        if (basis is not ("perGame" or "total")) throw new WnbaDataException(400, "basis must be perGame or total.");
        if (minGames < 0 || minGames > 10000 || minAttempts < 0 || minAttempts > 1000000)
            throw new WnbaDataException(400, "minGames must be 0–10000 and minAttempts must be 0–1000000.");
        var type = WnbaSeasonCalculator.NormalizeSeasonType(requestedType);
        var shooting = ShootingMetrics.Contains(metric);
        var all = Statistics(data, type, teamId);
        double? Value(WnbaPlayerSeasonStatistics p) => shooting ? p.Shooting[metric].Percentage :
            basis == "total" ? p.Statistics[metric].Total : p.Statistics[metric].PerGame;
        var eligible = all.Where(p => Value(p).HasValue && (shooting
                ? p.Shooting[metric].Games >= minGames && p.Shooting[metric].Attempted >= minAttempts
                : p.Statistics[metric].Games >= minGames))
            .OrderByDescending(Value).ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ThenBy(p => p.PlayerId, StringComparer.Ordinal).ToArray();
        double? previous = null;
        var rank = 0;
        for (var i = 0; i < eligible.Length; i++)
        {
            var current = Value(eligible[i]);
            if (i == 0 || previous != current) rank = i + 1;
            eligible[i].Rank = rank;
            previous = current;
        }
        var matching = string.IsNullOrWhiteSpace(search) ? eligible : eligible
            .Where(p => p.Name?.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) == true).ToArray();
        return new(data.Season, type, teamId, metric, basis, shooting, minGames, shooting ? minAttempts : 0,
            data.Games.Count(g => g.Completed == true && g.SeasonType.Equals(type, StringComparison.OrdinalIgnoreCase)),
            all.Count(p => p.Games > 0), eligible.Length, RankingMethod, matching);
    }
}
