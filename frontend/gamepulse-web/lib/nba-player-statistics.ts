export type NbaSeasonSummary = {
  playerId: number; playerName: string; season: number; seasonType: string;
  teamAbbreviation: string; games: number; totals: Record<string, number>;
  perGame: Record<string, number>; shooting: Record<string, number | null>;
  availableGameLogs: number; logsReconcile: boolean;
};
export type NbaPlayerGame = {
  gameId: string; date: string; matchup: string; result: string;
  teamAbbreviation: string; minutes: number; points: number; rebounds: number;
  assists: number; steals: number; blocks: number; turnovers: number;
  fgm: number; fga: number; fg3m: number; fg3a: number; ftm: number; fta: number;
};
export type NbaPlayerStatistics = {
  playerId: number; season: number; seasonType: string; status: string;
  availableSeasons: number[]; history: NbaSeasonSummary[];
  summary: NbaSeasonSummary | null; games: NbaPlayerGame[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  coverage: { source: string; importedAt: string; note: string; expectedGames: number | null;
    availableGames: number; logsReconcile: boolean | null; sourceSeason: number };
};
export type NbaStatsQuery = Record<string, string | string[] | undefined>;
export function nbaSeasonLabel(start: number) { return `${start}–${String(start + 1).slice(-2)}`; }
export function nbaStatsHref(id: number, season: number, type: string, page = 1) {
  return `/leagues/nba/players/${id}?${new URLSearchParams({ season: String(season), type, page: String(page) })}#season-statistics`;
}
export async function fetchNbaPlayerStatistics(id: number, query: NbaStatsQuery) {
  const params = new URLSearchParams();
  for (const key of ["season", "type", "page"]) {
    const value = query[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241").replace(/\/$/, "");
  const response = await fetch(`${base}/api/leagues/nba/player-stats/${id}?${params}`, {
    cache: "no-store", signal: AbortSignal.timeout(40000),
  });
  if (response.status === 404) return { status: "missing" as const };
  if (response.status === 400) return { status: "invalid" as const };
  if (!response.ok) throw new Error("NBA statistics unavailable");
  const data = await response.json() as NbaPlayerStatistics;
  if (data.playerId !== id || !Array.isArray(data.history) || !Array.isArray(data.games)) {
    throw new Error("Invalid NBA statistics response");
  }
  return { status: "ok" as const, data };
}
