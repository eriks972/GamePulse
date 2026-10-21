using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/team-stats")]
public class TeamStatsController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public TeamStatsController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTeamStats(
        string leagueSlug,
        [FromQuery] string? season = null
    )
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var teamStats = await _nbaDataService.GetTeamStatsAsync(season);

        return Ok(teamStats);
    }

    [HttpGet("{teamId:int}")]
    public async Task<IActionResult> GetTeamStatsByTeamId(
        string leagueSlug,
        int teamId,
        [FromQuery] string? season = null
    )
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var teamStats = await _nbaDataService.GetTeamStatsByTeamIdAsync(teamId, season);

        if (teamStats is null)
        {
            return NotFound(new
            {
                message = $"Team stats for team ID {teamId} were not found for league {leagueSlug}."
            });
        }

        return Ok(teamStats);
    }
}
