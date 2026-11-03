import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProfileSeasonSwitch } from "@/app/leagues/PlayerProfileUI";
import { PlayerSeason as MlbPlayer } from "@/app/leagues/mlb/SeasonInsights";
import { PlayerSeason as NflPlayer } from "@/app/leagues/nfl/SeasonInsights";
import { PlayerSeasonSummary } from "@/app/leagues/wnba/PlayerSeasonTable";
import { mlb } from "@/lib/mlb";
import { nfl, NflApiError } from "@/lib/nfl";
import { wnba } from "@/lib/wnba";
import mlbProfile from "./fixtures/four-league-profiles/mlb-profile.json";
import nflPlayer from "./fixtures/four-league-profiles/nfl-player.json";
import nflTeams from "./fixtures/four-league-profiles/nfl-teams.json";
import wnbaSummary from "./fixtures/four-league-profiles/wnba-summary.json";

jest.mock("@/lib/mlb", () => ({ ...jest.requireActual("@/lib/mlb"), mlb: jest.fn() }));
jest.mock("@/lib/nfl", () => ({ ...jest.requireActual("@/lib/nfl"), nfl: jest.fn() }));
jest.mock("@/lib/wnba", () => ({ ...jest.requireActual("@/lib/wnba"), wnba: jest.fn() }));
beforeEach(() => jest.resetAllMocks());

test("MLB headline rates match imported summary and detailed tables start folded", async () => {
  jest.mocked(mlb).mockImplementation(async path => path.endsWith("season-profile") ? mlbProfile : { results: { items: [], page: 1, pageSize: 10, total: 66 } } as never);
  render(await MlbPlayer({ season: "2026", id: mlbProfile.player.id, query: {} }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aaron Judge");
  expect(screen.getByText("Batting average").parentElement).toHaveTextContent("0.241");
  expect(within(screen.getByRole("heading", { name: "Season statistics" }).closest("section")!).getByText("OPS").parentElement).toHaveTextContent("0.871");
  expect(screen.getByText("Season breakdown").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Season breakdown"));
  expect(screen.getByText("Season breakdown").closest("details")).toHaveAttribute("open");
});

test("MLB game pagination keeps identity, phase, team, category and open panel", async () => {
  jest.mocked(mlb).mockImplementation(async path => path.endsWith("season-profile") ? mlbProfile : { results: { items: [], page: 2, pageSize: 10, total: 66 } } as never);
  render(await MlbPlayer({ season: "2026", id: mlbProfile.player.id, query: { page: "2", seasonType: "Playoffs", group: "pitching", teamId: "test-team" } }));
  expect(screen.getByText("Game log").closest("details")).toHaveAttribute("open");
  const url = new URL(screen.getByRole("link", { name: "← Previous" }).getAttribute("href")!, "http://localhost");
  expect(decodeURIComponent(url.pathname)).toContain(mlbProfile.player.id);
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: "1", seasonType: "Playoffs", teamId: "test-team", group: "pitching", panel: "games" });
  expect(url.hash).toBe("#game-log");
});

test("MLB pitcher default retains baseball outs notation rather than decimal rounding", async () => {
  const profile = { ...mlbProfile, batting: null, pitching: { ...mlbProfile.batting, inningsPitched: "5.2" } };
  jest.mocked(mlb).mockImplementation(async path => path.endsWith("season-profile") ? profile : { results: { items: [], page: 1, pageSize: 10, total: 0 } } as never);
  render(await MlbPlayer({ season: "2026", id: mlbProfile.player.id, query: {} }));
  expect(screen.getByRole("combobox", { name: "Game-log category" })).toHaveValue("pitching");
  expect(screen.getByText("Innings pitched").parentElement).toHaveTextContent("5.2");
});

test("WNBA preserves field-observation denominators and supports playoff summaries", async () => {
  jest.mocked(wnba).mockResolvedValue(wnbaSummary);
  render(await PlayerSeasonSummary({ playerId: wnbaSummary.playerId, name: wnbaSummary.name, season: "2024", query: { seasonType: "Playoffs" } }));
  expect(wnba).toHaveBeenCalledWith(expect.stringContaining("player-stats/"), { season: "2024", seasonType: "Playoffs" });
  expect(screen.getByText("Points per game").parentElement).toHaveTextContent(wnbaSummary.statistics.points.perGame!.toFixed(1));
  expect(screen.getByText("Sources and coverage").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Season breakdown"));
  expect(screen.getByRole("table", { name: "WNBA player season statistics" })).toBeVisible();
  expect(screen.getByText(/not verified appearances/)).toBeInTheDocument();
});

function fallbackRoutes(path: string) {
  if (path.endsWith("season-profile") || path.endsWith("season-log")) return Promise.reject(new NflApiError(404));
  return Promise.resolve(path === "teams" ? nflTeams : nflPlayer);
}
test("a roster-only NFL player survives missing season endpoints without invented stats", async () => {
  jest.mocked(nfl).mockImplementation(fallbackRoutes as typeof nfl);
  render(await NflPlayer({ season: "2026", id: "00-0037845", query: {} }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A.J. Arcuri");
  expect(screen.getByText(/Season summaries are unavailable/)).toBeVisible();
  expect(screen.queryByText("NFL entry unavailable")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Roster details"));
  expect(screen.getByText(/Jersey 68/)).toBeVisible();
  expect(screen.getByText("Game log").closest("details")).not.toHaveAttribute("open");
});

test("NFL service failures are not disguised as missing summary routes", async () => {
  jest.mocked(nfl).mockRejectedValue(new NflApiError(503));
  await expect(NflPlayer({ season: "2026", id: "00-0037845", query: {} })).rejects.toMatchObject({ status: 503 });
});

test("available NFL season summaries retain headline values and fold detailed categories", async () => {
  const row = { games: 3, observations: 3, totals: { passing_yards: 800, passing_tds: 6 }, rates: {}, fieldObservations: {}, teamContributions: [] };
  const profile = { player: { ...nflPlayer.player, position: "QB" }, teams: nflTeams, groups: { passing: row }, allTeamGroups: { passing: row }, method: "Test fixture", teamId: null };
  jest.mocked(nfl).mockImplementation(async path => path.endsWith("season-profile") ? profile : { items: [], page: 1, pageSize: 10, total: 0 } as never);
  render(await NflPlayer({ season: "2026", id: "test-qb", query: {} }));
  const headline = screen.getByRole("heading", { name: /Season statistics/ }).closest("section")!;
  expect(within(headline).getByText("YDS").parentElement).toHaveTextContent("800");
  expect(screen.getByText("Season breakdown").closest("details")).not.toHaveAttribute("open");
  expect(nfl).not.toHaveBeenCalledWith("teams", expect.anything());
});

test("NFL 404 plus an outage still reports the outage", async () => {
  jest.mocked(nfl).mockImplementation(path => Promise.reject(new NflApiError(path.endsWith("season-profile") ? 404 : 503)));
  await expect(NflPlayer({ season: "2026", id: "00-0037845", query: {} })).rejects.toMatchObject({ status: 503 });
});

test("a genuinely missing NFL identity still returns 404", async () => {
  jest.mocked(nfl).mockRejectedValue(new NflApiError(404));
  await expect(NflPlayer({ season: "2026", id: "missing", query: {} })).rejects.toMatchObject({ status: 404 });
});

test("season switch retains namespaced player path, uses NHL ending years, resets page and team", () => {
  render(<ProfileSeasonSwitch league="NHL" seasons={["2027", "2026"]} season="2027" action="/leagues/nhl/players/nhl%3Aplayer%3A8482515" endingYear query={{ seasonType: "Regular Season", page: "2", teamId: "old-team" }} />);
  expect(screen.getByRole("combobox", { name: "Season (ending year)" })).toHaveDisplayValue("2026–27");
  const form = screen.getByRole("button", { name: "Load season" }).closest("form")!;
  expect(form).toHaveAttribute("action", "/leagues/nhl/players/nhl%3Aplayer%3A8482515");
  expect(form.querySelector('[name="seasonType"]')).toHaveValue("Regular Season");
  expect(form.querySelector('[name="teamId"]')).toBeNull();
  expect(within(form).getByRole("combobox")).toHaveValue("2027");
});
