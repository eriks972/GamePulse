const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241").replace(/\/$/, "");
export type NflCoverage = { unassignedTeamStatRows?: number; resolvedPlayerTeamRows?: number; games: number; completedGames: number; teams: number; players: number; rosters: number; playerStats: number; teamStats: number; unassignedPlayerStatRows: number; rosterRowsWithoutPlayerId: number; missingCompletedTeamGames: number };
export type NflSeason = { season: number; generatedAtUtc: string; coverage: NflCoverage };
export type NflReport = NflSeason & { runId: string; method: string; phases: { seasonType: string; weeks: number[] }[] };
export type NflTeam = { teamId: string; name: string; conference: string | null; division: string | null; color: string | null; logoUrl: string | null };
export type NflPlayer = { playerId: string; name: string; position: string | null; teamIds: string[] };
export type NflGame = { gameId: string; season: number; seasonType: string; round: string; week: number; date: string; kickoffUtc: string | null; homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null; status: string; stadium: string | null };
export type NflRoster = { playerId: string | null; teamId: string; name: string | null; position: string | null; jerseyNumber: number | null; status: string | null };
export type NflStat = { gameId: string; seasonType: string; week: number; teamId: string; opponentTeamId: string; playerId: string | null; name: string | null; position: string | null; stats: Record<string, number | string | null> };
export type NflRecord = { teamId: string; seasonType: string; wins: number; losses: number; ties: number; played: number; pointsFor: number; pointsAgainst: number };
export type NflPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type NflStanding = { team: NflTeam; record: NflRecord | null; winPercentage: number | null };
export type NflStandings = { season: number; seasonType: string; method: string; teams: NflStanding[] };
export type NflTeamDetail = { team: NflTeam; records: NflRecord[]; games: NflGame[]; rosters: NflRoster[]; statistics: NflStat[] };
export type NflPlayerDetail = { player: NflPlayer; rosters: NflRoster[]; games: NflGame[]; statistics: NflStat[] };
export type NflGameDetail = { game: NflGame; teamStatistics: NflStat[]; playerStatistics: NflStat[] };
export class NflApiError extends Error { constructor(public status: number) { super(`NFL request failed (${status})`); } }
export async function nfl<T>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  const response = await fetch(`${base}/api/leagues/nfl/${path}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new NflApiError(response.status);
  return response.json() as Promise<T>;
}
export const nflHref = (path = "", query: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
  return `/leagues/nfl${path ? `/${path}` : ""}${params.size ? `?${params}` : ""}`;
};
export const nflEntity = (kind: "teams" | "players" | "game", id: string) => `${kind}/${encodeURIComponent(id)}`;
export const display = (v: number | string | null | undefined) => v == null ? "—" : typeof v === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v) : v;
export const phaseName = (p: string) => p === "REG" ? "Regular season" : p === "POST" ? "Postseason" : p === "PRE" ? "Preseason" : p;
export function dateLabel(value: string, time = false) {
  const date = new Date(time ? value : `${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: time ? "America/New_York" : "UTC", ...(time ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const : {}) }).format(date);
}
export const statGroups: Record<string, { label: string; columns: [string, string][] }> = {
  passing: { label: "Passing", columns: [["completions", "CMP"], ["attempts", "ATT"], ["passing_yards", "YDS"], ["passing_tds", "TD"], ["passing_interceptions", "INT"], ["sacks_suffered", "Sacks taken"]] },
  rushing: { label: "Rushing", columns: [["carries", "ATT"], ["rushing_yards", "YDS"], ["rushing_tds", "TD"], ["rushing_first_downs", "1st downs"], ["rushing_fumbles", "Fumbles"], ["rushing_fumbles_lost", "Lost"]] },
  receiving: { label: "Receiving", columns: [["targets", "TGT"], ["receptions", "REC"], ["receiving_yards", "YDS"], ["receiving_tds", "TD"], ["receiving_yards_after_catch", "YAC"], ["receiving_fumbles_lost", "Lost"]] },
  defense: { label: "Defense", columns: [["def_tackles_solo", "Solo"], ["def_tackle_assists", "Assists"], ["def_tackles_for_loss", "TFL"], ["def_sacks", "Sacks"], ["def_interceptions", "INT"], ["def_fumbles_forced", "FF"]] },
  kicking: { label: "Kicking", columns: [["fg_made", "FGM"], ["fg_att", "FGA"], ["fg_long", "Long"], ["pat_made", "XPM"], ["pat_att", "XPA"], ["pt_yards", "Punt YDS"]] },
};
