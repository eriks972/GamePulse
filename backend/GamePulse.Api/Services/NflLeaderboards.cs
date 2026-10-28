using System.Text.Json;
using GamePulse.Api.Models.Nfl;

namespace GamePulse.Api.Services;

public sealed record NflLeaderDefinition(string Opportunity, string[] Counts, string[] Rates);
public sealed record NflContribution(string TeamId, int Games, int Observations,
    Dictionary<string, long?> Totals, Dictionary<string, double?> Rates, Dictionary<string, int> FieldObservations);
public sealed record NflLeader(string PlayerId, string Name, string? Position, string[] TeamIds,
    int Games, int Observations, Dictionary<string, long?> Totals, Dictionary<string, double?> Rates,
    Dictionary<string, int> FieldObservations, NflContribution[] TeamContributions, int? Rank, double? Value);

public static class NflLeaderboards
{
    public static readonly IReadOnlyDictionary<string, NflLeaderDefinition> Definitions = new Dictionary<string, NflLeaderDefinition>
    {
        ["passing"] = new("attempts", ["attempts", "completions", "passing_yards", "passing_tds", "passing_interceptions"], ["completionPercentage", "yardsPerAttempt"]),
        ["rushing"] = new("carries", ["carries", "rushing_yards", "rushing_tds", "rushing_fumbles_lost"], ["yardsPerCarry"]),
        ["receiving"] = new("targets", ["targets", "receptions", "receiving_yards", "receiving_tds", "receiving_fumbles_lost"], ["yardsPerReception", "catchPercentage"])
    };

    private static long? Count(NflStat row, string key)
    {
        if (row.Stats.ValueKind != JsonValueKind.Object || !row.Stats.TryGetProperty(key, out var v) ||
            v.ValueKind != JsonValueKind.Number || !v.TryGetDouble(out var n) || !double.IsFinite(n) ||
            n != Math.Truncate(n) || n > long.MaxValue || n < long.MinValue || (n < 0 && !key.EndsWith("_yards"))) return null;
        return checked((long)n);
    }
    private static (Dictionary<string, long?> Totals, Dictionary<string, double?> Rates, Dictionary<string, int> Observed) Aggregate(NflStat[] rows, NflLeaderDefinition d)
    {
        var totals = new Dictionary<string, long?>(); var observed = new Dictionary<string, int>();
        foreach (var key in d.Counts)
        {
            var values = rows.Select(r => Count(r, key)).ToArray();
            observed[key] = values.Count(v => v.HasValue);
            totals[key] = observed[key] == rows.Length ? values.Sum(v => v!.Value) : null;
        }
        double? Ratio(string numerator, string denominator, double scale = 1) =>
            totals.GetValueOrDefault(numerator) is long n && totals.GetValueOrDefault(denominator) is long den && den > 0 ? scale * n / den : null;
        var rates = new Dictionary<string, double?>();
        foreach (var key in d.Rates) rates[key] = key switch
        {
            "completionPercentage" => totals["completions"] <= totals["attempts"] ? Ratio("completions", "attempts", 100) : null,
            "yardsPerAttempt" => Ratio("passing_yards", "attempts"),
            "yardsPerCarry" => Ratio("rushing_yards", "carries"),
            "yardsPerReception" => Ratio("receiving_yards", "receptions"),
            "catchPercentage" => totals["receptions"] <= totals["targets"] ? Ratio("receptions", "targets", 100) : null,
            _ => null
        };
        return (totals, rates, observed);
    }

    public static NflLeader[] Calculate(NflStat[] source, NflGame[] games, NflPlayer[] players,
        string group, string phase, string metric, string? team, string? position, int minOpportunities)
    {
        if (!Definitions.TryGetValue(group, out var d)) throw new NflDataException(400, "group must be passing, rushing, or receiving.");
        if (phase is not ("REG" or "POST")) throw new NflDataException(400, "seasonType must be REG or POST.");
        if (!d.Counts.Contains(metric) && !d.Rates.Contains(metric)) throw new NflDataException(400, "Unknown metric for this category.");
        if (minOpportunities < 0 || minOpportunities > 1000000) throw new NflDataException(400, "Minimum opportunities must be between 0 and 1000000.");
        var gameIndex = games.ToDictionary(g => g.GameId); var playerIndex = players.ToDictionary(p => p.PlayerId);
        var observed = new List<NflStat>(); var seen = new HashSet<(string, string, string)>();
        foreach (var r in source.Where(r => r.SeasonType == phase))
        {
            if (r.PlayerId is null || !playerIndex.ContainsKey(r.PlayerId) || !gameIndex.TryGetValue(r.GameId, out var g) ||
                g.Season != r.Season || g.SeasonType != r.SeasonType || g.Week != r.Week ||
                !(r.TeamId == g.HomeTeamId && r.OpponentTeamId == g.AwayTeamId || r.TeamId == g.AwayTeamId && r.OpponentTeamId == g.HomeTeamId) ||
                !seen.Add((r.GameId, r.TeamId, r.PlayerId))) throw new NflDataException(503, "NFL player statistics have invalid game relationships.");
            if (g.Status == "final" && (team is null || r.TeamId == team)) observed.Add(r);
        }
        var leaders = new List<NflLeader>();
        foreach (var rows in observed.GroupBy(r => r.PlayerId!))
        {
            var p = playerIndex[rows.Key]; var all = rows.ToArray();
            if (!string.IsNullOrEmpty(position) && !string.Equals(p.Position, position, StringComparison.OrdinalIgnoreCase)) continue;
            if (!all.Any(r => d.Counts.Any(k => Count(r, k) is long n && n != 0))) continue;
            var a = Aggregate(all, d);
            if (minOpportunities > 0 && !(a.Totals[d.Opportunity] is long opportunities && opportunities >= minOpportunities)) continue;
            var splits = all.GroupBy(r => r.TeamId).OrderBy(g => g.Key).Select(g =>
            {
                var r = g.ToArray(); var s = Aggregate(r, d);
                return new NflContribution(g.Key, r.Select(x => x.GameId).Distinct().Count(), r.Length, s.Totals, s.Rates, s.Observed);
            }).ToArray();
            double? value = a.Totals.TryGetValue(metric, out var total) ? total : a.Rates[metric];
            leaders.Add(new(p.PlayerId, p.Name ?? p.PlayerId, p.Position, splits.Select(s => s.TeamId).ToArray(),
                all.Select(r => r.GameId).Distinct().Count(), all.Length, a.Totals, a.Rates, a.Observed, splits, null, value));
        }
        var sorted = leaders.OrderBy(r => r.Value is null).ThenByDescending(r => r.Value).ThenBy(r => r.PlayerId, StringComparer.Ordinal).ToArray();
        int rank = 0; double? previous = null;
        for (int i = 0; i < sorted.Length; i++)
        {
            var r = sorted[i]; if (r.Value is null) continue;
            if (previous is null || r.Value != previous) rank = i + 1;
            sorted[i] = r with { Rank = rank }; previous = r.Value;
        }
        return sorted;
    }
}
