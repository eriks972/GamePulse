import Link from "next/link";
import {
  wnba, entityPath, wnbaHref, WnbaApiError, statValue,
  type WnbaStandings, type WnbaSeasonStatistics, type WnbaTeamSeasonStatistics,
  type SeasonMetric, type ShootingMetric,
} from "@/lib/wnba";
import type { Query } from "./Views";

const panel = "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl";
const input = "rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const link = "font-semibold text-blue-300 hover:text-blue-200 hover:underline";
const cell = "p-3 text-right tabular-nums";
const value = (query: Query, name: string) => typeof query[name] === "string" ? query[name] as string : "";
const percent = (number: number | null) => number == null ? "—" : (number * 100).toFixed(1) + "%";

async function request<T>(path: string, query: Record<string, string>) {
  try { return await wnba<T>(path, query); }
  catch (error) {
    // The season was already checked. A missing endpoint usually means the API update is not deployed yet.
    if (error instanceof WnbaApiError && error.status === 404) throw new WnbaApiError(503);
    throw error;
  }
}

export async function StandingsTable({ season }: { season: string }) {
  const report = await request<WnbaStandings>("standings", { season });
  return <>
    <section className={panel}>
      <h2 className="text-2xl font-bold">Calculated regular-season standings</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{report.rankingMethod}</p>
      <p className="mt-3 text-slate-300">{report.countedGames} games counted · {report.completedGames} marked complete · {report.scheduledGames} in the imported schedule</p>
      {report.excludedCompletedGames > 0 && <p className="mt-3 text-sm text-amber-300">{report.excludedCompletedGames} completed games excluded because a score is missing, invalid, or tied.</p>}
      {!report.countedGames && <p className="mt-3 text-amber-300">No completed regular-season games with valid final scores are available.</p>}
    </section>
    <section className={panel}><div className="relative overflow-x-auto">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">WNBA {season} calculated regular-season standings</caption>
        <thead className="text-slate-400"><tr>{["Rank", "Team", "GP", "W", "L", "Win %", "Home", "Away", "PF", "PA", "DIFF", "PPG", "Opp PPG", "Margin", "Score coverage"].map(label =>
          <th className={label === "Team" ? "p-3" : cell} scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{report.teams.map(team => <tr className="border-t border-slate-800" key={team.teamId}>
          <td className={cell}>{team.rank ?? "—"}</td><th scope="row" className="p-3"><Link className={link} href={wnbaHref(entityPath("teams", team.teamId), season)}>{team.name || team.abbreviation || "Team"}</Link></th>
          {[team.games, team.wins, team.losses].map((n, i) => <td className={cell} key={i}>{n}</td>)}
          <td className={cell}>{percent(team.winPercentage)}</td><td className={cell}>{team.homeWins}–{team.homeLosses}</td><td className={cell}>{team.awayWins}–{team.awayLosses}</td>
          {[team.pointsFor, team.pointsAgainst, team.pointDifferential, team.pointsPerGame, team.opponentPointsPerGame, team.scoringMargin].map((n, i) =>
            <td className={cell} key={i}>{i < 3 ? statValue(n) : n == null ? "—" : n.toFixed(1)}</td>)}
          <td className={cell}>{team.games}/{team.completedGames}</td>
        </tr>)}</tbody>
      </table>
    </div><p className="mt-4 text-xs leading-5 text-slate-400">GP counts games used for records. PF/PA are total schedule points for/against. DIFF is total point differential; Margin is differential per counted game. Score coverage is counted games / games marked complete. These totals reflect the imported snapshot.</p></section>
  </>;
}

const metricColumns = [["points", "PTS"], ["opponentPoints", "Opp PTS"], ["rebounds", "REB"], ["assists", "AST"], ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TO"]];
const shootingColumns = [["fieldGoals", "FG%"], ["threePointers", "3PT%"], ["freeThrows", "FT%"]];
function metric(team: WnbaTeamSeasonStatistics, key: string): SeasonMetric {
  return key === "opponentPoints" ? team.opponentStatistics.points : team.statistics[key];
}
function ObservedMetric({ data, completed, basis }: { data: SeasonMetric; completed: number; basis: "perGame" | "total" }) {
  const n = data[basis];
  return <><span>{n == null ? "—" : basis === "perGame" ? n.toFixed(1) : statValue(n)}</span>
    <span className="mt-1 block text-xs text-slate-500">{data.games}/{completed} games</span></>;
}
function ObservedShooting({ data, completed }: { data: ShootingMetric; completed: number }) {
  return <><span>{percent(data.percentage)}</span><span className="mt-1 block text-xs text-slate-500">{data.games}/{completed} games</span>
    <span className="sr-only">, made {statValue(data.made)} of {statValue(data.attempted)}</span></>;
}

export async function TeamStatisticsTable({ season, query }: { season: string; query: Query }) {
  const seasonType = value(query, "seasonType") === "Playoffs" ? "Playoffs" : "Regular Season";
  const basis = value(query, "basis") === "total" ? "total" : "perGame";
  const direction = value(query, "direction") === "asc" ? "asc" : "desc";
  const sortOptions = [...metricColumns, ...shootingColumns];
  const sort = sortOptions.some(([key]) => key === value(query, "sort")) ? value(query, "sort") : "points";
  const report = await request<WnbaSeasonStatistics>("team-stats", { season, seasonType });
  const teamId = value(query, "teamId");
  const rows = report.teams.filter(team => !teamId || team.teamId === teamId);
  const sortValue = (team: WnbaTeamSeasonStatistics) => team.shooting[sort]?.percentage ??
    (team.shooting[sort] ? null : metric(team, sort)[basis]);
  rows.sort((a, b) => {
    const av = sortValue(a), bv = sortValue(b);
    if (av == null && bv != null) return 1;
    if (av != null && bv == null) return -1;
    return av != null && bv != null && av !== bv ? (av - bv) * (direction === "asc" ? 1 : -1) : (a.name || "").localeCompare(b.name || "");
  });
  return <>
    <form action={wnbaHref("team-stats")} className={`${panel} flex flex-wrap items-end gap-4`}>
      <input type="hidden" name="season" value={season} />
      <label className="grid gap-2 text-sm text-slate-300">Season type<select className={input} name="seasonType" defaultValue={seasonType}>
        <option>Regular Season</option><option>Playoffs</option></select></label>
      <label className="grid gap-2 text-sm text-slate-300">Team<select className={`${input} max-w-full`} name="teamId" defaultValue={teamId}>
        <option value="">All teams</option>{report.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name || t.abbreviation || "Team"}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-slate-300">Display<select className={input} name="basis" defaultValue={basis}>
        <option value="perGame">Per game</option><option value="total">Totals</option></select></label>
      <label className="grid gap-2 text-sm text-slate-300">Sort by<select className={input} name="sort" defaultValue={sort}>
        {sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="grid gap-2 text-sm text-slate-300">Order<select className={input} name="direction" defaultValue={direction}>
        <option value="desc">High to low</option><option value="asc">Low to high</option></select></label>
      <button className="rounded-xl bg-blue-500 px-5 py-2 font-bold hover:bg-blue-400">Apply filters</button>
      <Link className={link} href={wnbaHref("team-stats", season)}>Reset</Link>
    </form>
    <section className={panel}><h2 className="text-2xl font-bold">{seasonType} · {basis === "perGame" ? "Per-game averages" : "Season totals"}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">Only completed games contribute. Each value shows observed games / completed team games. Missing values remain unavailable. Percentages use summed makes and attempts from games where both values are valid.</p>
      <p className="mt-3 text-slate-300">{report.completedGames} completed games · {report.scheduledGames} in this schedule selection</p>
      {!report.completedGames && <p className="mt-3 text-amber-300">No completed games for this season type.</p>}
      {!rows.length ? <p className="mt-5 text-slate-400">No teams match this selection.</p> : <div className="relative mt-5 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">WNBA {season} team season statistics</caption>
          <thead className="text-slate-400"><tr><th scope="col" className="p-3">Team</th>
            {["Completed GP", "Box coverage", "Opp box coverage", ...metricColumns.map(([, label]) => label), ...shootingColumns.map(([, label]) => label)].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}
          </tr></thead><tbody>{rows.map(team => <tr key={team.teamId} className="border-t border-slate-800">
            <th scope="row" className="p-3"><Link className={link} href={wnbaHref(entityPath("teams", team.teamId), season)}>{team.name || team.abbreviation || "Team"}</Link>
              {team.scoreDiscrepancyGames > 0 && <span className="mt-1 block text-xs font-normal text-amber-300">{team.scoreDiscrepancyGames} box/schedule score discrepancies</span>}</th>
            <td className={cell}>{team.completedGames}</td><td className={cell}>{team.teamStatsGames}/{team.completedGames}</td><td className={cell}>{team.opponentStatsGames}/{team.completedGames}</td>
            {metricColumns.map(([key]) => <td className={cell} key={key}><ObservedMetric data={metric(team, key)} completed={team.completedGames} basis={basis} /></td>)}
            {shootingColumns.map(([key]) => <td className={cell} key={key}><ObservedShooting data={team.shooting[key]} completed={team.completedGames} /></td>)}
          </tr>)}</tbody>
        </table></div>}
      <p className="mt-4 text-xs leading-5 text-slate-400">Box coverage counts team box-score rows, even if some fields are missing. Opp PTS comes from available opponent box scores. Statistics and standings may differ when box scores disagree with schedule scores. Partial totals and averages describe observed games only.</p>
    </section>
  </>;
}

export async function TeamSeasonSummary({ teamId, season }: { teamId: string; season: string }) {
  let stats: WnbaTeamSeasonStatistics;
  try { stats = await request<WnbaTeamSeasonStatistics>(`team-stats/${encodeURIComponent(teamId)}`, { season }); }
  catch { return <section className={panel}><h2 className="text-2xl font-bold">Season statistics unavailable</h2><p className="mt-3 text-slate-400">Try again after the data service update is available.</p></section>; }
  return <section className={panel}><div className="flex flex-wrap justify-between gap-4">
    <h2 className="text-2xl font-bold">Regular-season statistics</h2>
    <Link className={link} href={`${wnbaHref("team-stats", season)}&teamId=${encodeURIComponent(teamId)}`}>Full team statistics →</Link>
  </div><div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">{[["points", "Points / game"], ["rebounds", "Rebounds / game"], ["assists", "Assists / game"]].map(([key, label]) =>
    <div key={key} className="rounded-2xl bg-slate-950 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-xl font-bold"><ObservedMetric data={stats.statistics[key]} completed={stats.completedGames} basis="perGame" /></p></div>)}
    <div className="rounded-2xl bg-slate-950 p-4"><p className="text-sm text-slate-400">Field goals</p><p className="mt-2 text-xl font-bold"><ObservedShooting data={stats.shooting.fieldGoals} completed={stats.completedGames} /></p></div>
  </div></section>;
}
