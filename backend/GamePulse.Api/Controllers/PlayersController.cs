using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/players")]
public class PlayersController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public PlayersController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
    public async Task<IActionResult> GetPlayers(
        string leagueSlug,
        [FromQuery] int? teamId = null
    )
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var players = await _nbaDataService.GetPlayersAsync(teamId);

        return Ok(players);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetPlayerById(string leagueSlug, int id)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var player = await _nbaDataService.GetPlayerByIdAsync(id);

        if (player is null)
        {
            return NotFound(new
            {
                message = $"Player with ID {id} was not found for league {leagueSlug}."
            });
        }

        return Ok(player);
    }
}
