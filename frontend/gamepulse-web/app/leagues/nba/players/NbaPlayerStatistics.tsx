import Link from "next/link";
import { fetchNbaPlayerStatistics, nbaSeasonLabel, nbaStatsHref,
  type NbaPlayerStatistics as Statistics, type NbaStatsQuery } from "@/lib/nba-player-statistics";

function decimal(value: number | undefined) {
  return value === undefined ? "—" : value.toFixed(1);
}
function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
}
const phases: Record<string, string> = { "regular-season": "Regular season", playoffs: "Playoffs" };
const metrics = [["minutes", "MIN"], ["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"],
  ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TOV"]] as const;

export function NbaPlayerStatisticsView({ data }: { data: Statistics }) {
  const { summary, pagination } = data;
  return (
    <section id="season-statistics" className="mt-8 min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-8">
      <h2 className="text-2xl font-bold">Season statistics</h2>
      <p className="mt-2 text-slate-400">{nbaSeasonLabel(data.season)} · {phases[data.seasonType]} · SportsDataverse / NBA Stats</p>
      <form method="get" action={`/leagues/nba/players/${data.playerId}#season-statistics`} className="mt-5 flex flex-wrap items-end gap-4">
        <label className="grid gap-2 text-sm text-slate-300">Season
          <select name="season" defaultValue={String(data.season)} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
            {data.availableSeasons.map(year => <option key={year} value={year}>{nbaSeasonLabel(year)}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-slate-300">Competition
          <select name="type" defaultValue={data.seasonType} className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
            {Object.entries(phases).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-blue-500 px-5 py-3 font-semibold hover:bg-blue-400">Load statistics</button>
      </form>
      {summary ? <>
        <p className="mt-5 text-sm text-slate-400">Season team: {summary.teamAbbreviation || "Not supplied"}. Averages use the source’s season totals and games played.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">Games played</p><p className="mt-2 text-2xl font-bold">{summary.games}</p></div>
          {[["points", "Points per game"], ["rebounds", "Rebounds per game"], ["assists", "Assists per game"]].map(([key, label]) =>
            <div key={key} className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{decimal(summary.perGame[key])}</p></div>)}
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm"><caption className="sr-only">Season totals and per-game averages</caption>
            <thead><tr className="border-b border-slate-700 text-slate-400"><th className="p-3">Measure</th>{metrics.map(([key, label]) => <th className="p-3" key={key}>{label}</th>)}</tr></thead>
            <tbody>{["Total", "Per game"].map(label => <tr key={label} className="border-b border-slate-800"><th className="whitespace-nowrap p-3">{label}</th>{metrics.map(([key]) => <td className="p-3" key={key}>{label === "Total" && key !== "minutes" ? summary.totals[key] : decimal((label === "Total" ? summary.totals : summary.perGame)[key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[["fg", "Field goals", "fgm", "fga"], ["three", "Three-pointers", "fg3m", "fg3a"], ["ft", "Free throws", "ftm", "fta"]].map(([key, label, made, attempts]) =>
            <div key={key} className="rounded-2xl bg-slate-800 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-xl font-bold">{percent(summary.shooting[key])}</p><p className="mt-1 text-sm text-slate-400">{summary.totals[made]} / {summary.totals[attempts]}</p></div>)}
        </div>
        <h3 className="mt-8 text-xl font-semibold">Game log</h3>
        <p className="mt-2 text-sm text-slate-400">{data.coverage.availableGames} imported game logs for {summary.games} source appearances.
          {summary.logsReconcile ? " Counting-stat totals reconcile with the season summary." : " Game-log coverage differs from the season totals; averages above use the season summary."}</p>
        {data.games.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Player game log</caption>
          <thead><tr className="border-b border-slate-700 text-slate-400">{["Date", "Matchup", "W/L", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV"].map(x => <th key={x} className="whitespace-nowrap p-3">{x}</th>)}</tr></thead>
          <tbody>{data.games.map(g => <tr key={g.gameId} className="border-b border-slate-800"><td className="whitespace-nowrap p-3">{g.date}</td><td className="whitespace-nowrap p-3">{g.matchup}</td><td className="p-3">{g.result || "—"}</td><td className="p-3">{decimal(g.minutes)}</td>{[g.points, g.rebounds, g.assists, g.steals, g.blocks, g.turnovers].map((v, i) => <td key={i} className="p-3">{v}</td>)}</tr>)}</tbody>
        </table></div> : <p className="mt-4 text-slate-400">No game logs were supplied for this selection.</p>}
        {pagination.totalPages > 1 && <nav aria-label="Game log pages" className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {pagination.page > 1 && <Link className="font-semibold text-blue-300" href={nbaStatsHref(data.playerId, data.season, data.seasonType, pagination.page - 1)}>Previous games</Link>}
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          {pagination.page < pagination.totalPages && <Link className="font-semibold text-blue-300" href={nbaStatsHref(data.playerId, data.season, data.seasonType, pagination.page + 1)}>Next games</Link>}
        </nav>}
      </> : <p className="mt-6 rounded-xl bg-slate-800 p-4">No recorded appearances in the imported statistics for this player, season, and competition. Choose another season or competition below.</p>}
      <h3 className="mt-8 text-xl font-semibold">Imported season history</h3>
      <p className="mt-2 text-sm text-slate-400">Only imported seasons are shown. Missing seasons are not zero-stat seasons.</p>
      {data.history.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Imported player season history</caption>
        <thead><tr className="border-b border-slate-700 text-slate-400">{["Season", "Competition", "Team", "GP", "PPG", "RPG", "APG"].map(x => <th key={x} className="p-3">{x}</th>)}</tr></thead>
        <tbody>{data.history.map(s => <tr key={`${s.season}-${s.seasonType}`} className="border-b border-slate-800"><th className="whitespace-nowrap p-3"><Link className="text-blue-300" href={nbaStatsHref(data.playerId, s.season, s.seasonType)}>{nbaSeasonLabel(s.season)}</Link></th><td className="whitespace-nowrap p-3">{phases[s.seasonType]}</td><td className="p-3">{s.teamAbbreviation || "—"}</td><td className="p-3">{s.games}</td>{["points", "rebounds", "assists"].map(k => <td key={k} className="p-3">{decimal(s.perGame[k])}</td>)}</tr>)}</tbody>
      </table></div> : <p className="mt-4 text-slate-400">No season statistics have been imported for this player yet.</p>}
      <p className="mt-6 text-xs leading-relaxed text-slate-400">{data.coverage.note} Updated {data.coverage.importedAt.slice(0, 10)}.</p>
    </section>
  );
}

export default async function NbaPlayerStatistics({ id, query }: { id: number; query: NbaStatsQuery }) {
  const result = await fetchNbaPlayerStatistics(id, query).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") {
    return <StatsMessage id={id} text="NBA statistics are temporarily unavailable. Your player profile is still available; try loading statistics again." />;
  }
  if (result.status === "ok") return <NbaPlayerStatisticsView data={result.data} />;
  return <StatsMessage id={id} text={result.status === "missing"
    ? "NBA statistics have not been imported for the selected season."
    : "Choose a valid season, competition, and game-log page."} />;
}
function StatsMessage({ id, text }: { id: number; text: string }) {
  return <section id="season-statistics" className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
    <h2 className="text-2xl font-bold">Season statistics</h2><p className="mt-3 text-slate-400">{text}</p>
    <Link href={`/leagues/nba/players/${id}#season-statistics`} className="mt-4 inline-block text-blue-300">Load latest available statistics</Link>
  </section>;
}
