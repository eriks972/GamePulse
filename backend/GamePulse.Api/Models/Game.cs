using System.Text.Json.Serialization;

namespace GamePulse.Api.Models;

public class Game
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("externalGameId")]
    public string ExternalGameId { get; set; } = string.Empty;

    public string LeagueSlug { get; set; } = "nba";
    public string Season { get; set; } = string.Empty;
    public string SeasonType { get; set; } = "Regular Season";
    public string GameDate { get; set; } = string.Empty;

    public int HomeExternalTeamId { get; set; }
    public int AwayExternalTeamId { get; set; }

    public string HomeTeamName { get; set; } = string.Empty;
    public string HomeTeamAbbreviation { get; set; } = string.Empty;
    public int HomeScore { get; set; }

    public string AwayTeamName { get; set; } = string.Empty;
    public string AwayTeamAbbreviation { get; set; } = string.Empty;
    public int AwayScore { get; set; }

    public string Status { get; set; } = "Final";
}