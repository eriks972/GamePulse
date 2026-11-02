import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchClient from "@/app/search/SearchClient";
import { type SearchGroup, type SearchLeague } from "@/lib/search";

function group(league: SearchLeague, overrides: Partial<SearchGroup> = {}): SearchGroup {
  return { league, season: 2025, availableSeasons: [2025], status: "ok", messages: [], morePlayers: false, moreTeams: false,
    hits: [{ id: "1", name: `${league.toUpperCase()} Jordan`, kind: "players", detail: "Guard", href: `/leagues/${league}/players/1?season=2025` }], ...overrides };
}
const originalFetch = global.fetch;
beforeEach(() => { window.history.replaceState(null, "", "/search"); global.fetch = jest.fn(async input => ({ ok: true, json: async () => group(new URL(String(input), "http://localhost").searchParams.get("league") as SearchLeague) } as Response)); });
afterEach(() => { global.fetch = originalFetch; });
async function submit(name = "Jordan") {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Player or team name" }), name);
  await user.click(screen.getByRole("button", { name: "Search" }));
  return user;
}

test("does not contact the API before a valid search", async () => {
  render(<SearchClient />);
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/between 2 and 80/);
  expect(fetch).not.toHaveBeenCalled();
});
test("all-league search renders separate groups and season-preserving profile links", async () => {
  render(<SearchClient />); await submit();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Search complete"));
  expect(fetch).toHaveBeenCalledTimes(5);
  for (const league of ["nba", "wnba", "mlb", "nfl", "nhl"]) {
    expect(screen.getByRole("link", { name: new RegExp(`^${league.toUpperCase()} Jordan`) })).toHaveAttribute("href", `/leagues/${league}/players/1?season=2025`);
  }
  expect(screen.getByRole("region", { name: "NHL search results" })).toHaveTextContent("2024–25");
  expect(window.location.search).toContain("q=Jordan");
});
test("league, kind, and season filters are sent to the API", async () => {
  render(<SearchClient />); const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox", { name: "League" }), "mlb");
  await user.selectOptions(screen.getByRole("combobox", { name: "Find" }), "teams");
  await user.type(screen.getByRole("textbox", { name: "Season year" }), "2024");
  await submit(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const url = new URL(String((fetch as jest.Mock).mock.calls[0][0]), "http://localhost");
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Jordan", league: "mlb", kind: "teams", season: "2024" });
});
test("a missing season gives recovery guidance rather than a misleading no-match message", async () => {
  (fetch as jest.Mock).mockImplementation(async () => ({ ok: true, json: async () => group("mlb", { status: "missing-season", season: null, hits: [], messages: ["This season has not been imported for this league."] }) }));
  render(<SearchClient initial={{ q: "Jordan", league: "mlb", kind: "all", season: "1930" }} />);
  expect(await screen.findByText(/This season has not been imported/)).toBeInTheDocument();
  expect(screen.getByText(/Recent imported years/)).toBeInTheDocument();
  expect(screen.queryByText(/No matching/)).not.toBeInTheDocument();
});
test("successful empty results explain how to broaden the search", async () => {
  (fetch as jest.Mock).mockImplementation(async input => ({ ok: true, json: async () => group(new URL(input, "http://localhost").searchParams.get("league") as SearchLeague, { hits: [] }) }));
  render(<SearchClient />); await submit();
  await waitFor(() => expect(screen.getAllByText(/No matching players or teams/)).toHaveLength(5));
});
test("a failed league does not discard other league results and Retry can recover", async () => {
  let fail = true;
  (fetch as jest.Mock).mockImplementation(async input => {
    const league = new URL(input, "http://localhost").searchParams.get("league") as SearchLeague;
    if (league === "nfl" && fail) throw new Error("offline");
    return { ok: true, json: async () => group(league) };
  });
  render(<SearchClient />); const user = await submit();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Search complete"));
  expect(screen.getByRole("link", { name: /MLB Jordan/ })).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "NFL search results" })).getByText(/temporarily unavailable/)).toBeInTheDocument();
  fail = false; await user.click(screen.getByRole("button", { name: "Retry search" }));
  expect(await screen.findByRole("link", { name: /NFL Jordan/ })).toBeInTheDocument();
});
test("Reset clears filters, results, and URL state", async () => {
  render(<SearchClient />); const user = await submit();
  await screen.findByRole("link", { name: /MLB Jordan/ });
  await user.click(screen.getByRole("button", { name: "Reset search" }));
  expect(screen.getByRole("textbox", { name: "Player or team name" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "League" })).toHaveValue("all");
  expect(screen.queryByRole("heading", { name: /Results for/ })).not.toBeInTheDocument();
  expect(window.location.search).toBe("");
});
test("new searches ignore late responses from an older request", async () => {
  let finishOld!: (response: Response) => void;
  (fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  render(<SearchClient initial={{ q: "Old", league: "mlb", kind: "players", season: "2025" }} />);
  const user = userEvent.setup();
  const name = screen.getByRole("textbox", { name: "Player or team name" });
  await user.clear(name); await user.type(name, "Jordan");
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByRole("link", { name: /MLB Jordan/ });
  await act(async () => finishOld({ ok: true, json: async () => group("mlb", { hits: [] }) } as unknown as Response));
  expect(screen.getByRole("link", { name: /MLB Jordan/ })).toBeInTheDocument();
});

test("NBA catalog hits do not present the context year as verified season participation", async () => {
  (fetch as jest.Mock).mockImplementation(async () => ({ ok: true, json: async () => group("nba", { hits: [{
    id: "1628973", name: "Jalen Brunson", kind: "players", detail: "Guard",
    href: "/leagues/nba/players/1628973?season=2025", seasonScoped: false,
  }] }) }));
  render(<SearchClient initial={{ q: "Jalen Brunson", league: "nba", kind: "players", season: "2025" }} />);
  const link = await screen.findByRole("link", { name: /Jalen Brunson/ });
  expect(link).toHaveTextContent("Player catalog");
  expect(link).toHaveTextContent("Season statistics not verified");
  expect(link).not.toHaveTextContent("2025");
  expect(link).toHaveAttribute("href", "/leagues/nba/players/1628973?season=2025");
});
