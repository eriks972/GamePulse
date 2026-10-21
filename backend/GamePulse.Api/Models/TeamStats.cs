using System.Text.Json.Serialization;

namespace GamePulse.Api.Models;

public class TeamStats
{
    [JsonPropertyName("externalTeamId")]
    public int Id { get; set; }

    public string LeagueSlug { get; set; } = "nba";
    public string Season { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Abbreviation { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Conference { get; set; } = string.Empty;
    public string Division { get; set; } = string.Empty;

    public int Games { get; set; }

    public double Points { get; set; }
    public double OpponentPoints { get; set; }
    public double ScoringMarginTotal { get; set; }
    public double OffensiveRebounds { get; set; }
    public double DefensiveRebounds { get; set; }
    public double Rebounds { get; set; }
    public double Assists { get; set; }
    public double Steals { get; set; }
    public double Blocks { get; set; }
    public double Turnovers { get; set; }
    public double PersonalFouls { get; set; }
    public double FieldGoalsMade { get; set; }
    public double FieldGoalsAttempted { get; set; }
    public double ThreePointersMade { get; set; }
    public double ThreePointersAttempted { get; set; }
    public double FreeThrowsMade { get; set; }
    public double FreeThrowsAttempted { get; set; }

    public double PointsPerGame { get; set; }
    public double OpponentPointsPerGame { get; set; }
    public double ScoringMargin { get; set; }
    public double OffensiveReboundsPerGame { get; set; }
    public double DefensiveReboundsPerGame { get; set; }
    public double ReboundsPerGame { get; set; }
    public double AssistsPerGame { get; set; }
    public double StealsPerGame { get; set; }
    public double BlocksPerGame { get; set; }
    public double TurnoversPerGame { get; set; }
    public double PersonalFoulsPerGame { get; set; }

    public double FieldGoalPercentage { get; set; }
    public double ThreePointPercentage { get; set; }
    public double FreeThrowPercentage { get; set; }
}
