import Link from "next/link";
import {
  wnba, wnbaHref, entityPath, WnbaApiError, statValue,
  type WnbaTeam, type WnbaPlayerLeaderboard, type WnbaPlayerSeasonStatistics, type SeasonMetric,
} from "@/lib/wnba";
import type { Query } from "./Views";

const panel = "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl";
const input = "max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const link = "font-semibold text-blue-300 hover:text-blue-200 hover:underline";
const cell = "p-3 text-right tabular-nums";
const value = (q: Query, key: string) => typeof q[key] === "string" ? q[key] as string : "";
const count = (q: Query, key: string, fallback: number, max: number) => {
  const raw = value(q, key); const n = Number(raw);
  return raw !== "" && Number.isSafeInteger(n) && n >= 0 && n <= max ? n : fallback;
};
const columns = [["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"], ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TO"], ["minutes", "MIN"]];
const shooting = [["fieldGoals", "FG%"], ["threePointers", "3PT%"], ["freeThrows", "FT%"]];
const percent = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;

async function request<T>(path: string, query: Record<string, string>) {
  try { return await wnba<T>(path, query); }
  catch (error) {
    if (error instanceof WnbaApiError && error.status === 404) throw new WnbaApiError(503);
    throw error;
  }
}
function Observed({ metric, games, basis }: { metric: SeasonMetric; games: number; basis: "total" | "perGame" }) {
  const n = metric[basis];
  return <><span>{n == null ? "—" : basis === "perGame" ? n.toFixed(1) : statValue(n)}</span>
    <span className="mt-1 block text-xs text-slate-500" title="Observed statistic games / player games with statistics">{metric.games}/{games}</span></>;
}

export async function PlayerSeasonTable({ season, query }: { season: string; query: Query }) {
  const seasonType = value(query, "seasonType") === "Playoffs" ? "Playoffs" : "Regular Season";
  const basis = value(query, "basis") === "total" ? "total" : "perGame";
  const metrics = [...columns, ...shooting];
  const metric = metrics.some(([key]) => key === value(query, "metric")) ? value(query, "metric") : "points";
  const minGames = count(query, "minGames", seasonType === "Playoffs" ? 1 : 10, 10000);
  const minAttempts = count(query, "minAttempts", 50, 1000000);
  const filters = { season, seasonType, basis, metric, minGames: String(minGames), minAttempts: String(minAttempts),
    teamId: value(query, "teamId"), search: value(query, "search") };
  const [report, teams] = await Promise.all([
    request<WnbaPlayerLeaderboard>("player-stats", filters), wnba<WnbaTeam[]>("teams", { season }),
  ]);
  const pages = Math.max(1, Math.ceil(report.players.length / 40));
  const page = Math.min(pages, Math.max(1, count(query, "page", 1, 1000000)));
  const rows = report.players.slice((page - 1) * 40, page * 40);
  const pageHref = (target: number) => `${wnbaHref("player-stats")}?${new URLSearchParams({ ...filters, page: String(target) })}`;
  return <>
    <form action={wnbaHref("player-stats")} className={`${panel} flex flex-wrap items-end gap-4`}>
      <input type="hidden" name="season" value={season} />
      <label className="grid gap-2 text-sm text-slate-300">Season type<select className={input} name="seasonType" defaultValue={seasonType}><option>Regular Season</option><option>Playoffs</option></select></label>
      <label className="grid gap-2 text-sm text-slate-300">Team<select className={input} name="teamId" defaultValue={filters.teamId}>
        <option value="">All teams</option>{teams.map(t => <option value={t.id} key={t.id}>{t.name || t.abbreviation || "Team"}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-slate-300">Display<select className={input} name="basis" defaultValue={basis}><option value="perGame">Per game</option><option value="total">Totals</option></select></label>
      <label className="grid gap-2 text-sm text-slate-300">Rank by<select className={input} name="metric" defaultValue={metric}>{metrics.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-slate-300">Minimum stat games<input className={`${input} w-28`} name="minGames" type="number" min="0" max="10000" defaultValue={minGames} /></label>
      <label className="grid gap-2 text-sm text-slate-300">Minimum shot attempts<input className={`${input} w-28`} name="minAttempts" type="number" min="0" max="1000000" defaultValue={minAttempts} /></label>
      <label className="grid gap-2 text-sm text-slate-300">Player name<input className={`${input} w-48`} name="search" placeholder="Search players" defaultValue={filters.search} /></label>
      <button className="rounded-xl bg-blue-500 px-5 py-2 font-bold hover:bg-blue-400">Apply filters</button>
      <Link className={link} href={wnbaHref("player-stats", season)}>Reset</Link>
    </form>
    <section className={panel}>
      <h2 className="text-2xl font-bold">{seasonType} player leaders · {basis === "total" ? "Totals" : "Per game"}</h2>
      <p className="mt-3 text-slate-300">{report.qualifyingPlayers} qualifying players · {report.players.length} match the search · {report.playersWithStatistics} players with statistics</p>
      <p className="mt-3 text-sm leading-6 text-slate-400">{report.rankingMethod}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Team filters use only statistics recorded for that team. Minimum games applies to the selected statistic’s observed games. Minimum attempts applies only when ranking by FG%, 3PT%, or FT%; percentages use paired makes and attempts.</p>
      {!rows.length ? <p className="mt-6 rounded-xl bg-slate-950 p-5 text-slate-300">No players qualify for these filters. Try reducing the minimum games or attempts.</p> : <>
        <p className="mt-4 text-xs text-slate-500">Scroll the table horizontally to see every statistic. Small counts show observed stat games / player games with statistics.</p>
        <div className="relative mt-4 overflow-x-auto" role="region" aria-label="Player statistics table, scroll horizontally" tabIndex={0}>
          <table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">WNBA {season} player leaders</caption>
            <thead className="text-slate-400"><tr><th scope="col" className={cell}>Rank</th><th scope="col" className="p-3">Player</th><th scope="col" className="p-3">Teams</th><th scope="col" className={cell}>GP</th>
              {metrics.map(([key, label]) => <th scope="col" className={`${cell} ${metric === key ? "text-blue-300" : ""}`} key={key}>{label}</th>)}
            </tr></thead><tbody>{rows.map(player => <tr key={player.playerId} className="border-t border-slate-800">
              <td className={cell}>{player.rank ?? "—"}</td><th scope="row" className="p-3"><Link className={link} href={wnbaHref(entityPath("players", player.playerId), season)}>{player.name || "Player"}</Link>
                {player.excludedAmbiguousGames > 0 && <span className="mt-1 block text-xs font-normal text-amber-300">{player.excludedAmbiguousGames} ambiguous games excluded</span>}</th>
              <td className="p-3">{player.teamIds.map((id, i) => <span key={id}>{i > 0 && " / "}<Link className={link} href={wnbaHref(entityPath("teams", id), season)}>{teams.find(t => t.id === id)?.abbreviation || "Team"}</Link></span>)}</td>
              <td className={cell}>{player.games}</td>
              {columns.map(([key]) => <td className={`${cell} ${metric === key ? "text-blue-200" : ""}`} key={key}><Observed metric={player.statistics[key]} games={player.games} basis={basis} /></td>)}
              {shooting.map(([key]) => <td className={`${cell} ${metric === key ? "text-blue-200" : ""}`} key={key}>{percent(player.shooting[key].percentage)}<span className="mt-1 block text-xs text-slate-500">{player.shooting[key].games}/{player.games}</span></td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      <p className="mt-4 text-xs leading-5 text-slate-400">GP counts unambiguous player game-stat rows in completed games, not a verified appearance total. Missing rows are not assumed to be DNPs. Each average uses that field’s observed games, and partial totals cover observed games only. Shooting percentages always remain percentages in Totals mode.</p>
      {pages > 1 && <nav aria-label="Player statistics pagination" className="mt-6 flex justify-center gap-5">
        {page > 1 && <Link className={link} href={pageHref(page - 1)}>← Previous</Link>}<span className="text-slate-400">Page {page} of {pages}</span>
        {page < pages && <Link className={link} href={pageHref(page + 1)}>Next →</Link>}
      </nav>}
    </section>
  </>;
}

export async function PlayerSeasonSummary({ playerId, name, season }: { playerId: string; name: string | null; season: string }) {
  let report: WnbaPlayerSeasonStatistics;
  try { report = await request<WnbaPlayerSeasonStatistics>(`player-stats/${encodeURIComponent(playerId)}`, { season }); }
  catch { return <section className={panel}><h2 className="text-2xl font-bold">Player season statistics unavailable</h2><p className="mt-3 text-slate-400">Try again after the data service update is available.</p></section>; }
  return <section className={panel}><div className="flex flex-wrap justify-between gap-4"><h2 className="text-2xl font-bold">Regular-season player statistics</h2>
    <Link className={link} href={`${wnbaHref("player-stats", season)}&search=${encodeURIComponent(name || "")}&minGames=0`}>View player leaders →</Link>
  </div><p className="mt-3 text-sm text-slate-400">{report.games} games with statistics · Values show each field’s coverage.</p>
    {report.excludedAmbiguousGames > 0 && <p className="mt-2 text-sm text-amber-300">{report.excludedAmbiguousGames} ambiguous player/game observations excluded.</p>}
    <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">{[["points", "Points / game"], ["rebounds", "Rebounds / game"], ["assists", "Assists / game"]].map(([key, label]) => <div key={key} className="rounded-2xl bg-slate-950 p-4">
      <p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-xl font-bold"><Observed metric={report.statistics[key]} games={report.games} basis="perGame" /></p></div>)}
      <div className="rounded-2xl bg-slate-950 p-4"><p className="text-sm text-slate-400">Field goals</p><p className="mt-2 text-xl font-bold">{percent(report.shooting.fieldGoals.percentage)}</p><p className="mt-1 text-xs text-slate-500">{report.shooting.fieldGoals.games}/{report.games} games</p></div>
    </div>
  </section>;
}
