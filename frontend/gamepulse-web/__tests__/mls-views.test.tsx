import { render, screen, within } from "@testing-library/react";
import { MlsView } from "@/app/leagues/mls/Views";
import { getMlsSeason } from "@/lib/mls";
jest.mock("@/lib/mls", () => ({ ...jest.requireActual("@/lib/mls"), getMlsSeason: jest.fn() }));
test.each(["", "teams", "players", "schedule", "standings", "team-stats", "player-stats", "compare", "analytics", "team", "player", "game"])("%s remains accessible without data", async view => {
  (getMlsSeason as jest.Mock).mockResolvedValue({ seasons: [], data: null });
  render(await MlsView({ view, query: {} }));
  expect(screen.getByRole("heading", { name: "Data unavailable" })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "MLS sections" })).toBeInTheDocument();
});
test("partial imports show team links and pick up data", async () => {
  (getMlsSeason as jest.Mock).mockResolvedValue({ seasons: [2026], data: { season: 2026, teams: [{ id: "a", name: "Club A" }], players: [], games: [], teamStats: [], playerStats: [] } });
  render(await MlsView({ view: "teams", query: { season: "2026" } }));
  expect(screen.getByRole("link", { name: "Club A" })).toHaveAttribute("href", "/leagues/mls/teams/a?season=2026");
  expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
});

test("standings group teams by conference and restart ranks", async () => {
  (getMlsSeason as jest.Mock).mockResolvedValue({ seasons: [2026], data: {
    season: 2026,
    teams: [{ id: "e", name: "Eastern Club", conference: "Eastern" }, { id: "w", name: "Western Club", conference: "Western" }, { id: "e2", name: "Second Eastern Club", conference: "Eastern" }, { id: "u", name: "Unknown Club" }],
    players: [], teamStats: [], playerStats: [],
    games: [{ id: "g", date: "2026-03-01", homeTeamId: "w", awayTeamId: "e", completed: true, seasonType: "Regular Season", homeScore: 0, awayScore: 2 }],
  } });
  render(await MlsView({ view: "standings", query: { season: "2026" } }));
  const east = within(screen.getByRole("region", { name: "Eastern Conference standings" }));
  const west = within(screen.getByRole("region", { name: "Western Conference standings" }));
  expect(east.getAllByRole("row")).toHaveLength(3);
  expect(west.getAllByRole("row")).toHaveLength(2);
  expect(east.getAllByRole("row")[1]).toHaveTextContent("Eastern Club");
  expect(east.getAllByRole("row")[1].firstChild).toHaveTextContent("1");
  expect(west.getAllByRole("row")[1].firstChild).toHaveTextContent("1");
  expect(east.queryByRole("link", { name: "Western Club" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Conference unavailable" })).toBeInTheDocument();
});

test("player cards combine name and team filters and preserve season links", async () => {
  (getMlsSeason as jest.Mock).mockResolvedValue({ seasons: [2026], data: {
    season: 2026, teams: [{ id: "a", name: "Club A" }, { id: "b", name: "Club B" }],
    players: [{ id: "p", name: "Alex One", teamId: "a", position: "Forward" }, { id: "q", name: "Alex Two", teamId: "b" }, { id: "r", name: "Other Player", teamId: "a" }],
    games: [], teamStats: [], playerStats: [],
  } });
  render(await MlsView({ view: "players", query: { season: "2026", search: " ALEX ", teamId: "a" } }));
  expect(screen.getByRole("link", { name: "Alex One" })).toHaveAttribute("href", "/leagues/mls/players/p?season=2026");
  expect(screen.queryByRole("link", { name: "Alex Two" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Other Player" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/leagues/mls/players?season=2026");
  expect(screen.getByText("Forward")).toBeInTheDocument();
});
