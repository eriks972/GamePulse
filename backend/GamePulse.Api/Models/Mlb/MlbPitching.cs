namespace GamePulse.Api.Models.Mlb;
public sealed class MlbPitchingFile
{
    public int Version { get; set; }
    public int Season { get; set; }
    public MlbPitchingRow[] Rows { get; set; } = [];
}
public sealed class MlbPitchingRow
{
    public string Kind { get; set; } = "";
    public string Id { get; set; } = "";
    public string SeasonType { get; set; } = "";
    public string? TeamId { get; set; }
    public string[] TeamIds { get; set; } = [];
    public string? InningsPitched { get; set; }
    public int Games { get; set; }
    public int ObservationRows { get; set; }
    public Dictionary<string, long?> Totals { get; set; } = [];
    public Dictionary<string, double?> Rates { get; set; } = [];
    public Dictionary<string, int> ObservedRows { get; set; } = [];
}
