using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/seasons")]
public class SeasonsController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public SeasonsController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSeasons(string leagueSlug)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var seasons = await _nbaDataService.GetSeasonsAsync();

        return Ok(seasons);
    }
}