import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlayersClient from "@/app/leagues/nba/players/playersClient";
import type { Player } from "@/lib/api";

// Fictional players keep the tests independent of season imports and API calls.
function player(overrides: Partial<Player>): Player {
  return {
    id: 1, leagueSlug: "nba", firstName: "Avery", lastName: "Brooks",
    fullName: "Avery Brooks", displayLastCommaFirst: "Brooks, Avery",
    displayFiLast: "A. Brooks", slug: "avery-brooks", birthdate: "1995-01-01",
    school: "Sample College", country: "USA", lastAffiliation: "Sample College/USA",
    height: "6-3", weight: 200, seasonExperience: 5, jersey: "1", position: "Guard",
    rosterStatus: "Active", gamesPlayedCurrentSeason: true, externalTeamId: 1,
    teamName: "Harbor Hawks", teamAbbreviation: "HHK", teamCode: "hawks",
    teamCity: "Harbor", playerCode: "avery_brooks", fromYear: 2020, toYear: 2025,
    dLeague: false, nba: true, gamesPlayed: true, draftYear: "2020", draftRound: "1",
    draftNumber: "1", greatest75: false, ...overrides,
  };
}
const players: Player[] = [
  player({}),
  player({ id: 2, fullName: "Dana Reed", position: "Forward", rosterStatus: "Inactive",
    fromYear: 2010, toYear: 2018, teamName: "Valley Foxes", teamAbbreviation: "VFX" }),
  player({ id: 3, fullName: "Casey Morgan", position: "Center", country: "Canada" }),
  player({ id: 4, fullName: "Jordan Ellis", position: "Guard-Forward", rosterStatus: "Inactive",
    fromYear: 1990, toYear: 1999, teamName: "Valley Foxes", teamAbbreviation: "VFX" }),
];
function expectPlayers(...names: string[]) {
  expect(screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent)).toEqual(names);
}

describe("NBA player directory", () => {
  test("shows the supplied players and links each card to its profile", () => {
    render(<PlayersClient players={players} />);
    expectPlayers("Avery Brooks", "Dana Reed", "Casey Morgan", "Jordan Ellis");
    expect(screen.getByRole("link", { name: /Avery Brooks/ })).toHaveAttribute("href", "/leagues/nba/players/1");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  test("searches team abbreviations without case or surrounding-space sensitivity", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    await user.type(screen.getByRole("textbox", { name: "Search players" }), "  vFx  ");
    expectPlayers("Dana Reed", "Jordan Ellis");
  });

  test("combines roster status and position instead of applying only one filter", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Roster status" }), "Active");
    expectPlayers("Avery Brooks", "Casey Morgan");
    await user.selectOptions(screen.getByRole("combobox", { name: "Position" }), "Center");
    expectPlayers("Casey Morgan");
  });

  test("matches a combined Guard-Forward position when Guard is selected", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Position" }), "Guard");
    expectPlayers("Avery Brooks", "Jordan Ellis");
  });

  test("switching career era updates the visible players", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    const era = screen.getByRole("combobox", { name: "Career era" });
    await user.selectOptions(era, "2010");
    expectPlayers("Dana Reed");
    await user.selectOptions(era, "1990");
    expectPlayers("Jordan Ellis");
  });

  test("an unmatched search shows guidance and Reset Filters restores the list", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    const search = screen.getByRole("textbox", { name: "Search players" });
    await user.type(search, "No matching player");
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
    expect(screen.getByText(/Try changing your search, roster status, position, or era filter/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Avery Brooks/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset Filters" }));
    expect(search).toHaveValue("");
    expectPlayers("Avery Brooks", "Dana Reed", "Casey Morgan", "Jordan Ellis");
  });

  test("Clear filters resets search, status, position, and era together", async () => {
    const user = userEvent.setup();
    render(<PlayersClient players={players} />);
    const search = screen.getByRole("textbox", { name: "Search players" });
    const status = screen.getByRole("combobox", { name: "Roster status" });
    const position = screen.getByRole("combobox", { name: "Position" });
    const era = screen.getByRole("combobox", { name: "Career era" });
    await user.type(search, "Canada");
    await user.selectOptions(status, "Active");
    await user.selectOptions(position, "Center");
    await user.selectOptions(era, "2020");
    expectPlayers("Casey Morgan");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search).toHaveValue("");
    for (const select of [status, position, era]) expect(select).toHaveValue("all");
    expectPlayers("Avery Brooks", "Dana Reed", "Casey Morgan", "Jordan Ellis");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  test("handles an empty input dataset without inventing player cards", () => {
    render(<PlayersClient players={[]} />);
    expect(screen.getByRole("heading", { name: "No players found" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View Player/ })).not.toBeInTheDocument();
  });

  test("search can find a player beyond the initial 120-card display limit", async () => {
    const user = userEvent.setup();
    const largeList = Array.from({ length: 121 }, (_, i) => player({ id: i + 1, fullName: `Sample Player ${i + 1}` }));
    render(<PlayersClient players={largeList} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(120);
    expect(screen.queryByRole("heading", { name: "Sample Player 121" })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing first 120 matching players/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search players" }), "Sample Player 121");
    expectPlayers("Sample Player 121");
    expect(screen.queryByText(/Showing first 120 matching players/)).not.toBeInTheDocument();
  });
});
