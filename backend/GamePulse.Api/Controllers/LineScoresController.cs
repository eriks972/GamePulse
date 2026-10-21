using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/line-scores")]
public class LineScoresController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public LineScoresController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet("{gameId}")]
    public async Task<IActionResult> GetLineScoresByGameId(string leagueSlug, string gameId)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var lineScores = await _nbaDataService.GetLineScoresByGameIdAsync(gameId);

        return Ok(lineScores);
    }
}