using System.Text.Json.Serialization;

namespace GamePulse.Api.Models;

public class Team
{
    [JsonPropertyName("externalTeamId")]
    public int Id { get; set; }

    public string LeagueSlug { get; set; } = "nba";
    public string Name { get; set; } = string.Empty;
    public string Abbreviation { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Conference { get; set; } = string.Empty;
    public string Division { get; set; } = string.Empty;

    public int Wins { get; set; }
    public int Losses { get; set; }

    public string? Season { get; set; }
}