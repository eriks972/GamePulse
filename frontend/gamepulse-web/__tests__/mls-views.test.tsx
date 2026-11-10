import { render, screen } from "@testing-library/react";
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
