const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241").replace(/\/$/, "");

export type WnbaTeam = { id: string; name: string | null; abbreviation: string | null; season: number };
export type WnbaPlayer = {
  id: string; fullName: string | null; position: string | null; season: number;
  teamIds: string[]; rosterSnapshotTeamIds: string[];
};
type SideCoverage = { teamStatsAvailable?: boolean; playerStatRows?: number; playerPointsReconciled?: boolean };
export type WnbaGame = {
  id: string; season: number; seasonType: string; gameDate: string;
  homeTeamId: string; awayTeamId: string; homeTeamName: string | null; awayTeamName: string | null;
  homeScore: number | null; awayScore: number | null; completed: boolean | null; status: string;
  coverage: { home?: SideCoverage; away?: SideCoverage };
};
export type WnbaStat = {
  gameId: string; teamId: string; playerId?: string; playerName?: string | null; teamName?: string | null;
  statistics: Record<string, number | null>; sources: string[];
};
export type WnbaStatistics = {
  game: WnbaGame; hasTeamStatistics: boolean; hasPlayerStatistics: boolean;
  teamStatistics: WnbaStat[]; playerStatistics: WnbaStat[];
};
export type WnbaCoverage = {
  scheduleGames: number; completedGames: number; completedTeamSides: number;
  completedTeamSidesWithTeamStats: number; completedTeamSidesWithReconciledPlayerPoints: number;
  status: string; generatedAt?: string;
};
export type PlayerGame = { game: WnbaGame; statistics: WnbaStat[] };
export type WnbaStanding = {
  teamId: string; name: string | null; abbreviation: string | null; rank: number | null;
  scheduledGames: number; completedGames: number; games: number; excludedCompletedGames: number;
  wins: number; losses: number; winPercentage: number | null;
  homeWins: number; homeLosses: number; awayWins: number; awayLosses: number;
  pointsFor: number; pointsAgainst: number; pointDifferential: number;
  pointsPerGame: number | null; opponentPointsPerGame: number | null; scoringMargin: number | null;
};
export type WnbaStandings = {
  season: number; seasonType: string; scheduledGames: number; completedGames: number;
  countedGames: number; excludedCompletedGames: number; rankingMethod: string; teams: WnbaStanding[];
};
export type SeasonMetric = { total: number | null; perGame: number | null; games: number };
export type ShootingMetric = { made: number | null; attempted: number | null; percentage: number | null; games: number };
export type WnbaTeamSeasonStatistics = {
  season: number; seasonType: string; teamId: string; name: string | null; abbreviation: string | null;
  scheduledGames: number; completedGames: number; teamStatsGames: number; opponentStatsGames: number;
  scoreDiscrepancyGames: number;
  statistics: Record<string, SeasonMetric>; opponentStatistics: Record<string, SeasonMetric>;
  shooting: Record<string, ShootingMetric>; opponentShooting: Record<string, ShootingMetric>;
};
export type WnbaSeasonStatistics = {
  season: number; seasonType: string; scheduledGames: number; completedGames: number; teams: WnbaTeamSeasonStatistics[];
};
export class WnbaApiError extends Error {
  constructor(public status: number) { super(`WNBA request failed (${status})`); }
}
export async function wnba<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const response = await fetch(`${base}/api/leagues/wnba/${path}?${params}`, {
    cache: "no-store", signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new WnbaApiError(response.status);
  return response.json() as Promise<T>;
}
export const entityPath = (kind: "teams" | "players" | "games", id: string) => `${kind}/${encodeURIComponent(id)}`;
export function wnbaHref(path = "", season?: string) {
  return `/leagues/wnba${path ? `/${path}` : ""}${season ? `?season=${encodeURIComponent(season)}` : ""}`;
}
export function gameDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(date);
}
export function statValue(value: number | null | undefined) {
  return value == null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}
