using System.Text.Json.Serialization;

namespace GamePulse.Api.Models;

public class Player
{
    [JsonPropertyName("externalPlayerId")]
    public int Id { get; set; }

    public string LeagueSlug { get; set; } = "nba";
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DisplayLastCommaFirst { get; set; } = string.Empty;
    public string DisplayFiLast { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Birthdate { get; set; } = string.Empty;
    public string School { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string LastAffiliation { get; set; } = string.Empty;
    public string Height { get; set; } = string.Empty;
    public int Weight { get; set; }
    public int SeasonExperience { get; set; }
    public string Jersey { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string RosterStatus { get; set; } = string.Empty;
    public bool GamesPlayedCurrentSeason { get; set; }

    public int ExternalTeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string TeamAbbreviation { get; set; } = string.Empty;
    public string TeamCode { get; set; } = string.Empty;
    public string TeamCity { get; set; } = string.Empty;

    public string PlayerCode { get; set; } = string.Empty;
    public int FromYear { get; set; }
    public int ToYear { get; set; }
    public bool DLeague { get; set; }
    public bool Nba { get; set; }
    public bool GamesPlayed { get; set; }
    public string DraftYear { get; set; } = string.Empty;
    public string DraftRound { get; set; } = string.Empty;
    public string DraftNumber { get; set; } = string.Empty;
    public bool Greatest75 { get; set; }
}
