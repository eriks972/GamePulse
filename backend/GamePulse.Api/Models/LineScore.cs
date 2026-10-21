using System.Text.Json.Serialization;

namespace GamePulse.Api.Models;

public class LineScore
{
    [JsonPropertyName("gameId")]
    public string GameId { get; set; } = string.Empty;

    [JsonPropertyName("externalGameId")]
    public string ExternalGameId { get; set; } = string.Empty;

    public string LeagueSlug { get; set; } = "nba";
    public string Season { get; set; } = string.Empty;

    public int TeamExternalId { get; set; }
    public int TeamId { get; set; }

    public string TeamName { get; set; } = string.Empty;
    public string TeamAbbreviation { get; set; } = string.Empty;

    public bool IsHome { get; set; }

    public int Q1 { get; set; }
    public int Q2 { get; set; }
    public int Q3 { get; set; }
    public int Q4 { get; set; }

    public int Ot1 { get; set; }
    public int Ot2 { get; set; }
    public int OtAll { get; set; }

    public int Total { get; set; }
}