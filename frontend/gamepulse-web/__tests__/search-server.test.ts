/** @jest-environment node */
import { searchLeague } from "@/lib/search-server";
import { readSearch, SEARCH_LEAGUES, searchProfileHref, searchSeasonLabel, type SearchLeague, type SearchQuery } from "@/lib/search";
import { GET } from "@/app/api/search/route";
import nbaCatalog from "./fixtures/nba-player-catalog.json";

const query: SearchQuery = { q: "Jordan", league: "all", kind: "all", season: "2025" };
function source(league: SearchLeague, name: string): unknown {
  if (name === "seasons") return league === "nfl" ? [{ season: 2025 }, { season: 2024 }] : ["2024", "2025"];
  if (name === "teams" || name === "standings") return [{ id: `${league}:team:1`, externalTeamId: league === "nba" ? 10 : undefined, teamId: "BUF", name: "Jordan City", abbreviation: "JDC" }];
  const players = [{ id: league === "nba" ? 1 : `${league}:player:1`, playerId: "00-123", fullName: "Jordan Example", name: "Jordan Example", position: "Guard", fromYear: 2020, toYear: 2026 }];
  return ["nfl", "mlb", "nhl"].includes(league) ? { items: players, total: 1 } : players;
}
function transport(override?: (league: SearchLeague, endpoint: string, url: URL) => unknown) {
  return jest.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const [, league, endpoint] = url.pathname.match(/\/api\/leagues\/([^/]+)\/([^/]+)/)!;
    const value = override ? override(league as SearchLeague, endpoint, url) : source(league as SearchLeague, endpoint);
    return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  }) as jest.MockedFunction<typeof fetch>;
}
function search(league: SearchLeague, mock = transport(), draft = query) {
  return searchLeague(draft, league, new AbortController().signal, mock, "http://api.test");
}

describe("universal search adapters", () => {
  test.each(SEARCH_LEAGUES)("normalizes %s source identities and preserves season in both profile links", async league => {
    const result = await search(league);
    expect(result.status).toBe("ok");
    expect(result.availableSeasons).toEqual([2025, 2024]);
    expect(result.hits).toHaveLength(2);
    for (const hit of result.hits) expect(hit.href).toBe(searchProfileHref(league, hit.kind, hit.id, 2025));
    expect(result.hits.map(h => h.name)).toEqual(["Jordan Example", "Jordan City"]);
    if (league === "nba") expect(result.hits.find(h => h.kind === "teams")?.id).toBe("10");
    if (league === "nfl") expect(result.hits.map(h => h.id)).toEqual(["00-123", "BUF"]);
  });
  test("latest uses newest numeric imported season, independent of index order", async () => {
    expect((await search("mlb", transport(), { ...query, season: "" })).season).toBe(2025);
  });
  test("unimported year is explicit and does not silently substitute another year", async () => {
    const mock = transport();
    const result = await search("nfl", mock, { ...query, season: "1999" });
    expect(result.status).toBe("missing-season"); expect(result.hits).toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  test("an empty season index reports no imported seasons", async () => {
    const result = await search("wnba", transport(() => []));
    expect(result.status).toBe("missing-season");
    expect(result.messages.join()).toMatch(/No seasons/);
  });
  test("team abbreviation search is case-insensitive", async () => {
    const result = await search("mlb", transport(), { ...query, q: "jdc", kind: "teams" });
    expect(result.hits.map(h => h.name)).toEqual(["Jordan City"]);
  });
  test("player-only search skips team requests and requests one extra match for truncation", async () => {
    const mock = transport();
    await search("nfl", mock, { ...query, kind: "players" });
    expect(mock).toHaveBeenCalledTimes(2);
    const url = new URL(String(mock.mock.calls[1][0]));
    expect(url.searchParams.get("pageSize")).toBe("9");
    expect(url.searchParams.get("search")).toBe("Jordan");
  });
  test("caps paginated results at eight and exposes more matches", async () => {
    const mock = transport((league, endpoint) => endpoint !== "players" ? source(league, endpoint) : {
      items: Array.from({ length: 9 }, (_, i) => ({ id: `player:${i}`, fullName: `Jordan ${i}` })), total: 100,
    });
    const result = await search("mlb", mock, { ...query, kind: "players" });
    expect(result.hits).toHaveLength(8); expect(result.morePlayers).toBe(true);
  });
  test("NBA uses season standings for teams without treating catalog dates as season membership", async () => {
    const mock = transport();
    const result = await search("nba", mock, { ...query, season: "2024" });
    expect(mock.mock.calls.map(c => String(c[0])).join()).toContain("/standings?season=2024");
    expect(result.messages.join()).toMatch(/full player catalog/);
    const old = transport((league, endpoint) => endpoint === "players" ? [{ id: 1, fullName: "Jordan Example", fromYear: 1990, toYear: 1999 }] : source(league, endpoint));
    expect((await search("nba", old)).hits.filter(h => h.kind === "players")).toHaveLength(1);
  });
  test("a failed player dataset retains successful team matches with a warning", async () => {
    const mock = transport((league, endpoint) => endpoint === "players" ? { wrong: [] } : source(league, endpoint));
    const result = await search("nfl", mock);
    expect(result.status).toBe("partial"); expect(result.hits[0].kind).toBe("teams");
    expect(result.messages.join()).toMatch(/Player search is temporarily unavailable/);
  });
  test("invalid JSON or season schema is unavailable, not a successful empty search", async () => {
    const result = await search("wnba", transport(() => ({ seasons: [2025] })));
    expect(result.status).toBe("unavailable");
  });
  test("duplicate source identities do not create duplicate cards", async () => {
    const mock = transport((league, endpoint) => endpoint === "players" ? [{ id: 1, fullName: "Jordan Example", fromYear: 2020, toYear: 2026 }, { id: 1, fullName: "Jordan Example", fromYear: 2020, toYear: 2026 }] : source(league, endpoint));
    expect((await search("nba", mock, { ...query, kind: "players" })).hits).toHaveLength(1);
  });
  test("large source responses are bounded", async () => {
    const mock = jest.fn<Promise<Response>, [string | URL | Request]>(async () => new Response(" ".repeat(8 * 1024 * 1024 + 1))) as jest.MockedFunction<typeof fetch>;
    expect((await search("nfl", mock)).status).toBe("unavailable");
  });
});

describe("search validation and route", () => {
  test.each(["q=x", "q=Jordan&league=soccer", "q=Jordan&kind=anything", "q=Jordan&season=25", "q=Jordan&season=9999"])("rejects malformed input: %s", input => {
    expect(() => readSearch(new URLSearchParams(input))).toThrow();
  });
  test("trims names and preserves season labels and encoded profile IDs", () => {
    expect(readSearch(new URLSearchParams("q=++Jordan++")).q).toBe("Jordan");
    expect(searchSeasonLabel("nhl", 2025)).toBe("2024–25");
    expect(searchSeasonLabel("nba", 2025)).toBe("2025");
    expect(searchProfileHref("mlb", "players", "mlb:stats:player:1", 2025)).toContain("mlb%3Astats%3Aplayer%3A1?season=2025");
  });
  test("route rejects invalid or aggregate league requests before fetching", async () => {
    const mock = jest.spyOn(globalThis, "fetch");
    expect((await GET(new Request("http://site/api/search?q=x&league=nfl"))).status).toBe(400);
    expect((await GET(new Request("http://site/api/search?q=Jordan&league=all"))).status).toBe(400);
    expect(mock).not.toHaveBeenCalled(); mock.mockRestore();
  });
  test("route returns no-store normalized results", async () => {
    const mock = jest.spyOn(globalThis, "fetch").mockImplementation(transport());
    const response = await GET(new Request("http://site/api/search?q=Jordan&league=mlb&season=2025"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).hits).toHaveLength(2); mock.mockRestore();
  });
});

// Exact imported records, including externalPlayerId and stale toYear values.
describe("NBA imported-catalog regression", () => {
  test.each(nbaCatalog)("finds $fullName despite old catalog career dates", async player => {
    const mock = transport((league, endpoint) => endpoint === "players" ? nbaCatalog : source(league, endpoint));
    const result = await search("nba", mock, { ...query, q: player.fullName, kind: "players", season: "" });
    expect(result.status).toBe("ok");
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({ name: player.fullName, id: String(player.externalPlayerId),
      href: `/leagues/nba/players/${player.externalPlayerId}?season=2025`, seasonScoped: false });
  });
  test("explicit season still finds Brunson's catalog profile and preserves URL context", async () => {
    const mock = transport((league, endpoint) => endpoint === "players" ? nbaCatalog : source(league, endpoint));
    const result = await search("nba", mock, { ...query, q: "Jalen Brunson", season: "2024" });
    expect(result.hits[0].href).toBe("/leagues/nba/players/1628973?season=2024");
    expect(result.messages.join()).toContain("may be outdated");
  });
});
