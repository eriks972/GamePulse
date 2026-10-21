using GamePulse.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace GamePulse.Api.Controllers;

[ApiController]
[Route("api/leagues/{leagueSlug}/teams")]
public class TeamsController : ControllerBase
{
    private readonly NbaJsonDataService _nbaDataService;

    public TeamsController(NbaJsonDataService nbaDataService)
    {
        _nbaDataService = nbaDataService;
    }

    [HttpGet]
    public async Task<IActionResult> GetTeams(string leagueSlug)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var teams = await _nbaDataService.GetTeamsAsync();

        return Ok(teams.OrderBy(team => team.Name));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetTeamById(string leagueSlug, int id)
    {
        if (!leagueSlug.Equals("nba", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { message = $"League '{leagueSlug}' is not supported yet." });
        }

        var teams = await _nbaDataService.GetTeamsAsync();

        var team = teams.FirstOrDefault(team => team.Id == id);

        if (team is null)
        {
            return NotFound(new
            {
                message = $"Team with ID {id} was not found for league {leagueSlug}."
            });
        }

        return Ok(team);
    }
}