import { fireEvent, render, screen, within } from "@testing-library/react";
import { NbaPlayerStatisticsView } from "@/app/leagues/nba/players/NbaPlayerStatistics";
import { fetchNbaPlayerStatistics, nbaSeasonLabel, type NbaPlayerStatistics } from "@/lib/nba-player-statistics";
import fixture from "./fixtures/nba-player-statistics.json";

function data(): NbaPlayerStatistics { return JSON.parse(JSON.stringify(fixture)); }

test("keeps headline stats visible and folds detailed panels by default", () => {
  render(<NbaPlayerStatisticsView data={data()} />);
  expect(screen.getByText("Points per game")).toBeVisible();
  for (const title of ["Season breakdown", "Game log", "Season history", "Statistics sources"]) {
    expect(screen.getByText(title).closest("details")).not.toHaveAttribute("open");
  }
  fireEvent.click(screen.getByText("Season breakdown"));
  expect(screen.getByText("Season breakdown").closest("details")).toHaveAttribute("open");
  expect(screen.getByRole("table", { name: "Season totals and per-game averages" })).toBeVisible();
});

test("keeps game logs expanded when following a pagination link", () => {
  render(<NbaPlayerStatisticsView data={data()} expandGameLog />);
  expect(screen.getByText("Game log").closest("details")).toHaveAttribute("open");
  expect(screen.getByRole("link", { name: "Next games" })).toBeVisible();
});

test("season history compares the selected competition without duplicate phases", () => {
  render(<NbaPlayerStatisticsView data={data()} />);
  fireEvent.click(screen.getByText("Season history"));
  const table = screen.getByRole("table", { name: "Imported player season history" });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByRole("link", { name: "2025–26" })).toHaveAttribute("aria-current", "page");
});

test("renders actual Wembanyama totals, per-game averages and percentages", () => {
  const d = data();
  render(<NbaPlayerStatisticsView data={d} />);
  fireEvent.click(screen.getByText("Season breakdown"));
  const table = screen.getByRole("table", { name: "Season totals and per-game averages" });
  expect(within(table).getByText("1600")).toBeInTheDocument();
  expect(within(table).getByText("25.0")).toBeInTheDocument();
  expect(screen.getByText("64 imported game logs for 64 source appearances. Counting-stat totals reconcile with the season summary.")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Season" })).toHaveValue("2025");
  expect(screen.getByRole("combobox", { name: "Competition" })).toHaveValue("regular-season");
});

test("game pagination keeps player, season and competition", () => {
  render(<NbaPlayerStatisticsView data={data()} />);
  fireEvent.click(screen.getByText("Game log"));
  expect(screen.getByRole("link", { name: "Next games" })).toHaveAttribute("href", "/leagues/nba/players/1641705?season=2025&type=regular-season&page=2&panel=games#game-log");
});

test("an empty selected season is not displayed as zero production", () => {
  const d = data();d.summary = null;d.games = [];
  render(<NbaPlayerStatisticsView data={d} />);
  expect(screen.getByText(/No recorded appearances in the imported statistics/)).toBeInTheDocument();
  expect(screen.queryByText("Points per game")).not.toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Imported player season history" })).toBeInTheDocument();
});

test("partial logs are disclosed without changing the published averages", () => {
  const d = data();d.summary!.logsReconcile = false;d.coverage.availableGames = 20;
  render(<NbaPlayerStatisticsView data={d} />);
  expect(screen.getByText(/Game-log coverage differs from the season totals/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Season breakdown"));
  expect(screen.getByRole("table", { name: "Season totals and per-game averages" })).toHaveTextContent("1600");
});

test("zero shooting attempts do not claim a zero-percent shooting rate", () => {
  const d = data();d.summary!.shooting.three = null;
  render(<NbaPlayerStatisticsView data={d} />);
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

test("start years are displayed as NBA season ranges", () => {
  expect(nbaSeasonLabel(2023)).toBe("2023–24");
  expect(nbaSeasonLabel(2025)).toBe("2025–26");
});

test("fetch forwards only supported query fields with no cache", async () => {
  const old = global.fetch;
  const mock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => data() });
  global.fetch = mock;
  try {
    const result = await fetchNbaPlayerStatistics(1641705, { season: "2025", type: "playoffs", page: "2", extra: "ignore" });
    expect(result.status).toBe("ok");
    expect(mock.mock.calls[0][0]).toContain("/player-stats/1641705?season=2025&type=playoffs&page=2");
    expect(mock.mock.calls[0][1].cache).toBe("no-store");
  } finally { global.fetch = old; }
});

test("missing statistics and service failures remain distinct", async () => {
  const old = global.fetch;
  try {
    global.fetch = jest.fn().mockResolvedValue({ status: 404, ok: false });
    expect((await fetchNbaPlayerStatistics(1641705, {})).status).toBe("missing");
    global.fetch = jest.fn().mockResolvedValue({ status: 503, ok: false });
    await expect(fetchNbaPlayerStatistics(1641705, {})).rejects.toThrow("unavailable");
  } finally { global.fetch = old; }
});
