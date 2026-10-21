using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/standings")]
public class StandingsController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public StandingsController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
    public async Task<IActionResult> GetStandings(string leagueSlug, [FromQuery] string? season = null)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var standings = await _nbaDataService.GetStandingsAsync(season);

        return Ok(standings);
    }
}