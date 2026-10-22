using GamePulse.Api.Models.Wnba;

namespace GamePulse.Api.Services;

public static class WnbaComparisonCalculator
{
    public static WnbaComparison Compare(WnbaSeasonData data, string teamAId, string teamBId, string? seasonType = null)
    {
        var a = data.Teams.FirstOrDefault(t => t.Id == teamAId)
            ?? throw new WnbaDataException(404, "Team A was not found in the selected season.");
        var b = data.Teams.FirstOrDefault(t => t.Id == teamBId)
            ?? throw new WnbaDataException(404, "Team B was not found in the selected season.");
        if (a.Id == b.Id) throw new WnbaDataException(400, "Choose two different WNBA teams.");
        var type = WnbaSeasonCalculator.NormalizeSeasonType(seasonType);
        var records = WnbaSeasonCalculator.Records(data, type).Teams.ToDictionary(t => t.TeamId);
        var stats = WnbaSeasonCalculator.TeamStatistics(data, type).Teams.ToDictionary(t => t.TeamId);
        // These are comparison records, not league/bracket ranks.
        records[a.Id].Rank = records[b.Id].Rank = null;
        var games = data.Games.Where(g => g.SeasonType.Equals(type, StringComparison.OrdinalIgnoreCase) &&
            ((g.HomeTeamId == a.Id && g.AwayTeamId == b.Id) || (g.HomeTeamId == b.Id && g.AwayTeamId == a.Id)))
            .OrderByDescending(g => g.GameDate).ThenBy(g => g.Id, StringComparer.Ordinal).ToArray();
        var completed = games.Count(g => g.Completed == true);
        var finals = games.Where(WnbaSeasonCalculator.HasFinalScore).ToArray();
        var aWins = finals.Count(g => g.HomeTeamId == a.Id ? g.HomeScore > g.AwayScore : g.AwayScore > g.HomeScore);
        return new(data.Season, type, new(a, records[a.Id], stats[a.Id]), new(b, records[b.Id], stats[b.Id]),
            new(games.Length, completed, finals.Length, completed - finals.Length, aWins, finals.Length - aWins, games));
    }
}
