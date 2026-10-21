using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/games")]
public class GamesController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public GamesController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
public async Task<IActionResult> GetGames(
    string leagueSlug,
    [FromQuery] string? season = null,
    [FromQuery] string? seasonType = null
)
{
    try
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var selectedSeason = string.IsNullOrWhiteSpace(season)
            ? "2022"
            : season;

        var selectedSeasonType = string.IsNullOrWhiteSpace(seasonType)
            ? "Regular Season"
            : seasonType;

        var games = await _nbaDataService.GetGamesAsync(selectedSeason, selectedSeasonType);

        return Ok(games);
    }
    catch (Exception ex)
    {
        Console.WriteLine("GamesController.GetGames failed");
        Console.WriteLine(ex.Message);
        Console.WriteLine(ex.StackTrace);

        return StatusCode(500, new
        {
            message = "Failed to load NBA games.",
            error = ex.Message
        });
    }
}
    
    [HttpGet("{gameId}")]
    public async Task<IActionResult> GetGameById(string leagueSlug, string gameId)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        Console.WriteLine($"GamesController received gameId: {gameId}");

        var game = await _nbaDataService.GetGameByIdAsync(gameId);

        if (game == null)
        {
            return NotFound(new
            {
                message = $"Game with ID {gameId} was not found for league {leagueSlug}."
            });
        }

        return Ok(game);
    }
}