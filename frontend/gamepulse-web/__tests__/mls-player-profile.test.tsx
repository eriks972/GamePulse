import { render, screen, within } from "@testing-library/react";
import { MlsView } from "@/app/leagues/mls/Views";
import { MlsPlayerProfile } from "@/app/leagues/mls/PlayerProfile";
import { getMlsSeason, type MlsSeason } from "@/lib/mls";
import { normalizeMlsRouteId, playerMetricItems, playerSeasonStats } from "@/lib/mls-player-profile";

jest.mock("@/lib/mls", () => ({ ...jest.requireActual("@/lib/mls"), getMlsSeason: jest.fn() }));

// Aaron Herrera's imported regular-season values, verified against the live
// MLS API. The playoff and missing-stat examples below are test-only fixtures.
const id = "mls:espn:player:256210";
const teamId = "mls:espn:team:193";
const regular = { games: 7, goals: 0, assists: 0, shots: 8, shotsOnTarget: 1, saves: null, fouls: 5, yellowCards: 1, redCards: 0, offsides: 0, minutes: null };
const fixture = (): MlsSeason => ({ season: 2026, teams: [{ id: teamId, name: "D.C. United" }], players: [{ id, name: "Aaron Herrera", teamId, position: "Substitute" }], games: [], teamStats: [], playerStats: [{ id, statistics: regular }] });

beforeEach(() => { jest.mocked(getMlsSeason).mockResolvedValue({ seasons: [2026, 2025], data: fixture() }); });

test("the encoded ID from the real MLS URL renders the player and stored totals", async () => {
  render(await MlsView({ view: "player", query: { season: "2026" }, id: encodeURIComponent(id) }));
  expect(screen.getByRole("heading", { level: 1, name: "Aaron Herrera" })).toBeInTheDocument();
  expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  const games = screen.getByText("Games with statistics", { selector: "dt" }).parentElement!;
  expect(within(games).getByText("7")).toBeInTheDocument();
  const goals = screen.getByText("Goals", { selector: "dt" }).parentElement!;
  expect(within(goals).getByText("0")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Compare this player →" }).getAttribute("href")).toContain("left=mls%3Aespn%3Aplayer%3A256210");
  expect(screen.getByText("Season breakdown").closest("details")).not.toHaveAttribute("open");
  expect(screen.queryByRole("heading", { name: "MLS Player Profile" })).not.toBeInTheDocument();
});

test("raw IDs work and malformed percent escapes do not crash", () => {
  expect(normalizeMlsRouteId(id)).toBe(id);
  expect(normalizeMlsRouteId(encodeURIComponent(id))).toBe(id);
  expect(normalizeMlsRouteId("bad%zz")).toBe("bad%zz");
  expect(normalizeMlsRouteId(undefined)).toBeUndefined();
});

test("unknown IDs never fall back to a different player", async () => {
  render(await MlsView({ view: "player", query: { season: "2026" }, id: "mls:espn:player:missing" }));
  expect(screen.getByRole("heading", { name: "Player not found in 2026" })).toBeInTheDocument();
  expect(screen.queryByText("Aaron Herrera")).not.toBeInTheDocument();
});

test("a roster-only player retains the profile without invented zero totals", () => {
  const data=fixture();data.playerStats=[];
  render(<MlsPlayerProfile data={data} seasons={[2026]} id={id} />);
  expect(screen.getByRole("heading", { name: "Aaron Herrera" })).toBeInTheDocument();
  expect(screen.getByText("Statistics unavailable for this selection")).toBeInTheDocument();
  expect(screen.queryByRole("definition")).not.toBeInTheDocument();
});

test("playoffs use a separate row and preserve competition on season changes", () => {
  const data=fixture();data.playerStats.push({id,seasonType:"Playoffs",statistics:{games:2,goals:1}});
  render(<MlsPlayerProfile data={data} seasons={[2026,2025]} id={id} phase="Playoffs" />);
  const games=screen.getByText("Games with statistics",{selector:"dt"}).parentElement!;
  expect(within(games).getByText("2")).toBeInTheDocument();
  expect(document.querySelector('input[type="hidden"][name="seasonType"]')).toHaveValue("Playoffs");
});

test("a missing playoff row does not display regular-season statistics", () => {
  render(<MlsPlayerProfile data={fixture()} seasons={[2026]} id={id} phase="Playoffs" />);
  expect(screen.getByText("Statistics unavailable for this selection")).toBeInTheDocument();
  expect(screen.getByRole("link", {name:"View regular season statistics →"})).toBeInTheDocument();
  expect(screen.queryByText("Goals", {selector:"dt"})).not.toBeInTheDocument();
});

test("legacy unscoped exports mean regular season only", () => {
  expect(playerSeasonStats(fixture(),id,"Regular Season")?.statistics.games).toBe(7);
  expect(playerSeasonStats(fixture(),id,"Playoffs")).toBeUndefined();
});

test("goalkeeper metrics preserve unknown fields as dashes", () => {
  const metrics=playerMetricItems({id:"g",name:"Goalkeeper",position:"G"},{id:"g",statistics:{games:1,saves:0,minutes:null}});
  expect(metrics.find(x=>x.label==="Saves")?.value).toBe("0");
  expect(metrics.find(x=>x.label==="Minutes")?.value).toBe("—");
  expect(metrics.find(x=>x.label==="Clean sheets")?.value).toBe("—");
});

test("historical archive IDs resolve without an ESPN identity guess", async () => {
  const data=fixture();const archive="mls:archive:player:abc123";
  data.players[0].id=archive;data.playerStats[0].id=archive;
  jest.mocked(getMlsSeason).mockResolvedValue({seasons:[1996],data:{...data,season:1996}});
  render(await MlsView({view:"player",query:{season:"1996"},id:encodeURIComponent(archive)}));
  expect(screen.getByRole("heading",{name:"Aaron Herrera"})).toBeInTheDocument();
});

test("statistics pagination keeps the selected competition", async () => {
  const data=fixture(); data.playerStats=Array.from({length:26},(_,n)=>({id:`p${n}`,seasonType:"Playoffs",statistics:{goals:n}}));
  data.players=data.playerStats.map(p=>({id:p.id,name:p.id}));
  jest.mocked(getMlsSeason).mockResolvedValue({seasons:[2026],data});
  render(await MlsView({view:"player-stats",query:{season:"2026",seasonType:"Playoffs"}}));
  for(const next of screen.getAllByRole("link",{name:"Next →"})) expect(next.getAttribute("href")).toContain("seasonType=Playoffs");
});

test("the player directory can filter out roster-only entries", async () => {
  const data=fixture();data.players.push({id:"bench",name:"Roster-only player"});
  jest.mocked(getMlsSeason).mockResolvedValue({seasons:[2026],data});
  render(await MlsView({view:"players",query:{season:"2026",coverage:"available"}}));
  expect(screen.getByRole("heading",{name:"Aaron Herrera"})).toBeInTheDocument();
  expect(screen.queryByText("Roster-only player")).not.toBeInTheDocument();
});
