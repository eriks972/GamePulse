import { getMlsSeason, mlsStandings, type MlsSeason } from "@/lib/mls";

const data: MlsSeason = {
  season: 2026,
  teams: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  players: [], teamStats: [], playerStats: [],
  games: [
    { id: "win", date: "2026-03-01", homeTeamId: "a", awayTeamId: "b", completed: true, homeScore: 2, awayScore: 0, seasonType: "Regular Season" },
    { id: "draw", date: "2026-03-02", homeTeamId: "b", awayTeamId: "a", completed: true, homeScore: 1, awayScore: 1, seasonType: "Regular Season" },
    { id: "missing", date: "2026-03-03", homeTeamId: "a", awayTeamId: "b", completed: true, homeScore: null, awayScore: null, seasonType: "Regular Season" },
    { id: "playoff", date: "2026-03-04", homeTeamId: "a", awayTeamId: "b", completed: true, homeScore: 0, awayScore: 5, seasonType: "Playoffs" },
    { id: "scheduled", date: "2026-03-05", homeTeamId: "a", awayTeamId: "b", completed: false, homeScore: 0, awayScore: 0, seasonType: "Regular Season" },
  ],
};
test("standings use scored regular-season finals and soccer points, including away draws", () => {
  const [first, second] = mlsStandings(data);
  expect(first).toMatchObject({ played: 2, wins: 1, draws: 1, losses: 0, points: 4, goalsFor: 3, goalsAgainst: 1 });
  expect(second).toMatchObject({ played: 2, wins: 0, draws: 1, losses: 1, points: 1, goalDifference: -2 });
});
test("teams with no results retain zero games rather than invented rates", () => {
  expect(mlsStandings({ ...data, games: [] })[0]).toMatchObject({ played: 0, points: 0 });
});
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterAll(() => { global.fetch = originalFetch; });
test("missing data is safe and a later request picks up an imported season", async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ seasons: [], data: null }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ seasons: [2026], data }) });
  expect((await getMlsSeason()).data).toBeNull();
  expect((await getMlsSeason("2026")).data).toEqual(data);
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/leagues/mls/season?season=2026"), expect.objectContaining({ cache: "no-store" }));
});
test.each([404, 503])("an unavailable backend (%s) returns a safe empty state", async status => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status });
  expect((await getMlsSeason()).data).toBeNull();
});
test("network failures return an empty state", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("offline"));
  expect((await getMlsSeason()).data).toBeNull();
});

test("shootout scores are excluded when regulation scores are unknown", () => {
  const standings = mlsStandings({ ...data, games: [{ ...data.games[0], shootout: true }] });
  expect(standings[0]).toMatchObject({ played: 0, points: 0 });
});
