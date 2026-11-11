namespace GamePulse.Api.Models.Mls;

public sealed class MlsSeason
{
    public int Season { get; set; }
    public MlsTeam[] Teams { get; set; } = [];
    public MlsPlayer[] Players { get; set; } = [];
    public MlsGame[] Games { get; set; } = [];
    public MlsStat[] TeamStats { get; set; } = [];
    public MlsStat[] PlayerStats { get; set; } = [];
    public MlsGameStat[] GameTeamStats { get; set; } = [];
    public MlsGameStat[] GamePlayerStats { get; set; } = [];
}
public sealed class MlsTeam
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Abbreviation { get; set; }
    public string? Conference { get; set; }
    public string? Venue { get; set; }
}
public sealed class MlsPlayer
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? TeamId { get; set; }
    public string[] ObservedTeamIds { get; set; } = [];
    public string? Position { get; set; }
}
public sealed class MlsGame
{
    public string Id { get; set; } = "";
    public string Date { get; set; } = "";
    public string? StartTime { get; set; }
    public bool Shootout { get; set; }
    public string? ShootoutWinnerTeamId { get; set; }
    public int? ShootoutWinPoints { get; set; }
    public string HomeTeamId { get; set; } = "";
    public string AwayTeamId { get; set; } = "";
    public string SeasonType { get; set; } = "Regular Season";
    public string? Status { get; set; }
    public bool Completed { get; set; }
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
}
public sealed class MlsStat
{
    public string Id { get; set; } = "";
    public string SeasonType { get; set; } = "Regular Season";
    public Dictionary<string, double?> Statistics { get; set; } = [];
}

public sealed class MlsGameStat
{
    public string GameId { get; set; } = "";
    public string TeamId { get; set; } = "";
    public string? PlayerId { get; set; }
    public Dictionary<string, double?> Statistics { get; set; } = [];
}

