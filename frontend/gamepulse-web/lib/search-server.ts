// Imported by the search Route Handler only. No source datasets are copied or written.
import { isSearchLeague, SEARCH_LIMIT, searchProfileHref, type SearchGroup, type SearchHit, type SearchLeague, type SearchQuery } from "./search";

type Row = Record<string, unknown>;
type Transport = typeof fetch;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid source record");
  return value as Row;
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function identity(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error("Invalid source identity");
}
function records(value: unknown, paginated = false): Row[] {
  const items = paginated ? row(value).items : value;
  if (!Array.isArray(items)) throw new Error("Invalid source list");
  return items.map(row);
}
function years(value: unknown, league: SearchLeague): number[] {
  if (!Array.isArray(value)) throw new Error("Invalid season list");
  const result = value.map(item => {
    const year = league === "nfl" ? row(item).season : item;
    if ((typeof year !== "number" && typeof year !== "string") || !/^\d{4}$/.test(String(year))) throw new Error("Invalid season year");
    const n = Number(year);
    if (n < 1876 || n > 2100) throw new Error("Invalid season year");
    return n;
  });
  return [...new Set(result)].sort((a, b) => b - a);
}
async function json(url: string, signal: AbortSignal, transport: Transport): Promise<unknown> {
  const response = await transport(url, { signal, cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok || !response.body) throw new Error("Source unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error("Source response too large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
}
export async function searchLeague(query: SearchQuery, league: SearchLeague, signal: AbortSignal,
  transport: Transport = fetch, base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241"): Promise<SearchGroup> {
  if (!isSearchLeague(league)) throw new Error("Unknown league");
  const result: SearchGroup = { league, season: null, availableSeasons: [], status: "ok", hits: [], messages: [], morePlayers: false, moreTeams: false };
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
  const root = `${base.replace(/\/$/, "")}/api/leagues/${league}/`;
  try {
    result.availableSeasons = years(await json(root + "seasons", deadline, transport), league);
    const selected = query.season ? Number(query.season) : result.availableSeasons[0];
    if (!selected || !result.availableSeasons.includes(selected)) {
      result.status = "missing-season";
      result.messages.push(result.availableSeasons.length === 0 ? "No seasons have been imported for this league." : "This season has not been imported for this league.");
      return result;
    }
    result.season = selected;
    const kinds = query.kind === "all" ? ["players", "teams"] as const : [query.kind];
    const responses = await Promise.allSettled(kinds.map(async kind => {
      const params = new URLSearchParams({ season: String(selected) });
      if (kind === "players" && league !== "nba") params.set("search", query.q);
      const paginated = kind === "players" && ["mlb", "nfl", "nhl"].includes(league);
      if (paginated) { params.set("page", "1"); params.set("pageSize", String(SEARCH_LIMIT + 1)); }
      // NBA's team catalog is current branding; standings contains the selected season's teams.
      const path = league === "nba" && kind === "teams" ? "standings" : kind;
      const source = await json(root + path + "?" + params, deadline, transport);
      const items = records(source, paginated);
      // NBA profiles come from a separate global catalog. Its career endpoints
      // can lag the game data; they cannot establish season membership.
      const needle = query.q.toLocaleLowerCase("en-US");
      const hits: SearchHit[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        let name = text(kind === "players" && ["nba", "mlb", "wnba"].includes(league) ? item.fullName : item.name);
        const abbreviation = text(item.abbreviation);
        if (league === "nhl" && kind === "teams") name = name.replace(/^(.+?)(?: \1)+(?= |$)/, "$1");
        if (!name || !(kind === "teams" ? [name, abbreviation] : [name]).some(v => v.toLocaleLowerCase("en-US").includes(needle))) continue;
        const id = identity(league === "nfl" ? item[kind === "players" ? "playerId" : "teamId"] : league === "nba" ? (kind === "teams" ? item.externalTeamId ?? item.id : item.id ?? item.externalPlayerId) : item.id);
        if (seen.has(id)) continue;
        seen.add(id);
        hits.push({ id, name, kind, detail: kind === "players" ? text(item.position) : abbreviation,
          href: searchProfileHref(league, kind, id, selected),
          seasonScoped: !(league === "nba" && kind === "players") });
      }
      hits.sort((a, b) => a.name.localeCompare(b.name, "en-US") || a.id.localeCompare(b.id, "en-US"));
      return { kind, hits: hits.slice(0, SEARCH_LIMIT), more: hits.length > SEARCH_LIMIT };
    }));
    responses.forEach((response, index) => {
      if (response.status === "fulfilled") {
        result.hits.push(...response.value.hits);
        if (response.value.kind === "players") result.morePlayers = response.value.more;
        else result.moreTeams = response.value.more;
      } else {
        result.status = "partial";
        result.messages.push(`${kinds[index] === "players" ? "Player" : "Team"} search is temporarily unavailable. Retry this search.`);
      }
    });
    if (responses.every(r => r.status === "rejected")) result.status = "unavailable";
    if (league === "nba" && query.kind !== "teams") result.messages.push("NBA player names are searched across the full player catalog, whose career dates and team assignments may be outdated. The season filter applies to teams; player matches do not confirm season appearances or statistics.");
    return result;
  } catch {
    result.status = "unavailable";
    result.messages.push("This league is temporarily unavailable. The backend may be waking up; retry this search.");
    return result;
  }
}
