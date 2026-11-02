export const SEARCH_LEAGUES = ["nba", "wnba", "mlb", "nfl", "nhl"] as const;
export type SearchLeague = typeof SEARCH_LEAGUES[number];
export type SearchKind = "all" | "players" | "teams";
export type SearchQuery = { q: string; league: SearchLeague | "all"; kind: SearchKind; season: string };
export type SearchHit = { id: string; name: string; kind: "players" | "teams"; detail: string; href: string; seasonScoped?: boolean };
export type SearchGroup = {
  league: SearchLeague; season: number | null; availableSeasons: number[];
  status: "ok" | "partial" | "missing-season" | "unavailable";
  hits: SearchHit[]; messages: string[]; morePlayers: boolean; moreTeams: boolean;
};
export const SEARCH_LIMIT = 8;
export const EMPTY_SEARCH: SearchQuery = { q: "", league: "all", kind: "all", season: "" };
export function isSearchLeague(value: string): value is SearchLeague {
  return (SEARCH_LEAGUES as readonly string[]).includes(value);
}
export function readSearch(params: URLSearchParams): SearchQuery {
  const league = params.get("league") || "all", kind = params.get("kind") || "all";
  const q = (params.get("q") || "").trim(), season = (params.get("season") || "").trim();
  if (q.length < 2 || q.length > 80) throw new Error("Enter a name or team abbreviation between 2 and 80 characters.");
  if (league !== "all" && !isSearchLeague(league)) throw new Error("Choose one of the five supported leagues.");
  if (!["all", "players", "teams"].includes(kind)) throw new Error("Choose players, teams, or both.");
  if (season && (!/^\d{4}$/.test(season) || Number(season) < 1876 || Number(season) > 2100)) throw new Error("Enter a four-digit season year between 1876 and 2100, or leave it blank.");
  return { q, league: league as SearchQuery["league"], kind: kind as SearchKind, season };
}
export function searchParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams({ q: query.q, league: query.league, kind: query.kind });
  if (query.season) params.set("season", query.season);
  return params;
}
export function searchSeasonLabel(league: SearchLeague, season: number): string {
  return league === "nhl" ? `${season - 1}–${String(season).slice(-2)}` : String(season);
}
export function searchProfileHref(league: SearchLeague, kind: "players" | "teams", id: string, season: number): string {
  return `/leagues/${league}/${kind}/${encodeURIComponent(id)}?season=${season}`;
}
