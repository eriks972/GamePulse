namespace GamePulse.Api.Models.Mlb;
public sealed class MlbBattingFile
{
    public int Version { get; set; }
    public int Season { get; set; }
    public MlbBattingRow[] Rows { get; set; } = [];
}
public sealed class MlbBattingRow
{
    public string Kind { get; set; } = "";
    public string Id { get; set; } = "";
    public string SeasonType { get; set; } = "";
    public string? TeamId { get; set; }
    public string[] TeamIds { get; set; } = [];
    public int Games { get; set; }
    public int ObservationRows { get; set; }
    public Dictionary<string, long?> Totals { get; set; } = [];
    public Dictionary<string, double?> Rates { get; set; } = [];
    public Dictionary<string, int> ObservedRows { get; set; } = [];
}
