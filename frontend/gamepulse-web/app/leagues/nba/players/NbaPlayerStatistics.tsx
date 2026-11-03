import Link from "next/link";
import { fetchNbaPlayerStatistics, nbaSeasonLabel, nbaStatsHref,
  type NbaPlayerStatistics as Statistics, type NbaStatsQuery } from "@/lib/nba-player-statistics";
import ProfileAccordion from "./ProfileAccordion";

function decimal(value: number | undefined) { return value === undefined ? "—" : value.toFixed(1); }
function percent(value: number | null | undefined) { return value == null ? "—" : `${(value * 100).toFixed(1)}%`; }
const phases: Record<string, string> = { "regular-season": "Regular season", playoffs: "Playoffs" };
const metrics = [["minutes", "MIN"], ["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"],
  ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TOV"]] as const;
const cell = "whitespace-nowrap px-3 py-3 text-right tabular-nums";
const heading = "whitespace-nowrap px-3 py-3 text-right text-xs font-medium tracking-wide text-slate-400";
function gamesHref(data: Statistics, page: number) {
  return nbaStatsHref(data.playerId, data.season, data.seasonType, page).replace("#season-statistics", "&panel=games#game-log");
}

export function NbaPlayerStatisticsView({ data, expandGameLog = false }: { data: Statistics; expandGameLog?: boolean }) {
  const { summary, pagination } = data;
  const history = data.history.filter(s => s.seasonType === data.seasonType).sort((a, b) => b.season - a.season);
  const key = `${data.season}-${data.seasonType}-${pagination.page}`;
  return (
    <section id="season-statistics" aria-label="Player season statistics" className="mt-6 min-w-0 scroll-mt-52 space-y-4 md:scroll-mt-32">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold tracking-tight sm:text-2xl">Season statistics</h2><p className="mt-1 text-sm text-slate-400">{phases[data.seasonType]}{summary ? ` · ${summary.teamAbbreviation || "Team not supplied"}` : ""}</p></div>
          <span className="rounded-lg border border-blue-400/20 bg-blue-400/5 px-3 py-1.5 text-sm font-semibold text-blue-300">{nbaSeasonLabel(data.season)}</span>
        </div>
        <form method="get" action={`/leagues/nba/players/${data.playerId}#season-statistics`} className="mt-5 grid grid-cols-2 items-end gap-3 border-t border-slate-800 pt-5 sm:flex sm:flex-wrap">
          <label className="grid min-w-0 gap-2 text-xs font-medium text-slate-400 sm:w-40">Season
            <select name="season" defaultValue={String(data.season)} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              {data.availableSeasons.map(year => <option key={year} value={year}>{nbaSeasonLabel(year)}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-xs font-medium text-slate-400 sm:w-48">Competition
            <select name="type" defaultValue={data.seasonType} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              {Object.entries(phases).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className="col-span-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold outline-none transition hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">Load statistics</button>
        </form>
        {summary ? <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[["Games played", String(summary.games)], ["Points per game", decimal(summary.perGame.points)],
              ["Rebounds per game", decimal(summary.perGame.rebounds)], ["Assists per game", decimal(summary.perGame.assists)],
              ["Field goal percentage", percent(summary.shooting.fg)], ["Minutes per game", decimal(summary.perGame.minutes)]].map(([label, value], index) =>
              <div key={label} className={`rounded-xl border p-3.5 ${index === 1 ? "border-blue-400/30 bg-blue-400/10" : "border-slate-800 bg-slate-950/40"}`}><p className="text-xs leading-relaxed text-slate-400">{label}</p><p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${index === 1 ? "text-blue-300" : "text-slate-100"}`}>{value}</p></div>)}
          </div>
          {!summary.logsReconcile && <p className="mt-4 text-sm leading-relaxed text-amber-200">Game-log totals differ from the season summary. Averages use the published season totals.</p>}
        </> : <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm leading-relaxed text-slate-300">No recorded appearances in the imported statistics for this player, season, and competition. Choose another selection or browse the season history.</p>}
      </div>

      {summary && <>
        <ProfileAccordion key={`breakdown-${key}`} title="Season breakdown" description="Totals, per-game averages, and shooting splits">
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Season totals and per-game averages</caption>
            <thead><tr className="border-b border-slate-700"><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-400">Measure</th>{metrics.map(([name, label]) => <th scope="col" key={name} className={heading}>{label}</th>)}</tr></thead>
            <tbody>{["Total", "Per game"].map(label => <tr key={label} className="border-b border-slate-800"><th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-medium text-slate-200">{label}</th>{metrics.map(([name]) => <td key={name} className={cell}>{label === "Total" && name !== "minutes" ? summary.totals[name] : decimal((label === "Total" ? summary.totals : summary.perGame)[name])}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{[["fg", "Field goals", "fgm", "fga"], ["three", "Three-pointers", "fg3m", "fg3a"], ["ft", "Free throws", "ftm", "fta"]].map(([name, label, made, attempts]) =>
            <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{percent(summary.shooting[name])}</p><p className="mt-1 text-xs text-slate-400">{summary.totals[made]} made / {summary.totals[attempts]} attempted</p></div>)}
          </div>
        </ProfileAccordion>

        <ProfileAccordion key={`games-${key}`} id="game-log" title="Game log" description={`${data.coverage.availableGames} available games · Newest first`} defaultOpen={expandGameLog || pagination.page > 1}>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">{data.coverage.availableGames} imported game logs for {summary.games} source appearances.{summary.logsReconcile ? " Counting-stat totals reconcile with the season summary." : " Game-log coverage differs from the season totals; averages above use the season summary."}</p>
          {data.games.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Player game log</caption>
            <thead><tr className="border-b border-slate-700"><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-400">Date</th><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-400">Matchup</th>{["W/L", "MIN", "PTS", "REB", "AST", "STL", "BLK", "TOV"].map(label => <th scope="col" key={label} className={heading}>{label}</th>)}</tr></thead>
            <tbody>{data.games.map(g => <tr key={g.gameId} className="border-b border-slate-800/70 even:bg-slate-950/20"><th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-normal tabular-nums text-slate-300">{g.date}</th><td className="whitespace-nowrap px-3 py-3 text-slate-300">{g.matchup}</td><td className={`${cell} ${g.result === "W" ? "text-emerald-300" : "text-slate-400"}`}>{g.result || "—"}</td><td className={cell}>{decimal(g.minutes)}</td>{[g.points, g.rebounds, g.assists, g.steals, g.blocks, g.turnovers].map((value, i) => <td key={i} className={cell}>{value}</td>)}</tr>)}</tbody>
          </table></div> : <p className="text-sm text-slate-400">No game logs were supplied for this selection.</p>}
          {pagination.totalPages > 1 && <nav aria-label="Game log pages" className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4 text-sm">
            <span className="text-slate-400">Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-3">
              {pagination.page > 1 && <a className="rounded-lg border border-slate-700 px-3 py-2 font-medium text-blue-300 hover:bg-slate-800" href={gamesHref(data, pagination.page - 1)}>Previous games</a>}
              {pagination.page < pagination.totalPages && <a className="rounded-lg border border-slate-700 px-3 py-2 font-medium text-blue-300 hover:bg-slate-800" href={gamesHref(data, pagination.page + 1)}>Next games</a>}
            </div>
          </nav>}
        </ProfileAccordion>
      </>}

      <ProfileAccordion key={`history-${key}`} title="Season history" description={`${phases[data.seasonType]} · ${history.length} imported ${history.length === 1 ? "season" : "seasons"}`} defaultOpen={!summary}>
        <p className="mb-4 text-sm text-slate-400">Only imported seasons are shown. Missing seasons are not zero-stat seasons.</p>
        {history.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Imported player season history</caption>
          <thead><tr className="border-b border-slate-700"><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-400">Season</th><th scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-400">Team</th>{["GP", "PPG", "RPG", "APG", "FG%"].map(label => <th scope="col" key={label} className={heading}>{label}</th>)}</tr></thead>
          <tbody>{history.map(s => <tr key={s.season} className={`border-b border-slate-800/70 ${s.season === data.season ? "bg-blue-400/5" : "even:bg-slate-950/20"}`}><th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-medium"><a className="text-blue-300 underline-offset-4 hover:underline" aria-current={s.season === data.season ? "page" : undefined} href={nbaStatsHref(data.playerId, s.season, s.seasonType)}>{nbaSeasonLabel(s.season)}</a></th><td className="px-3 py-3 text-slate-400">{s.teamAbbreviation || "—"}</td><td className={cell}>{s.games}</td>{["points", "rebounds", "assists"].map(name => <td key={name} className={cell}>{decimal(s.perGame[name])}</td>)}<td className={cell}>{percent(s.shooting.fg)}</td></tr>)}</tbody>
        </table></div> : <p className="text-sm text-slate-400">No season statistics have been imported for this player and competition yet.</p>}
      </ProfileAccordion>

      <ProfileAccordion title="Statistics sources" description="Coverage, calculation notes, and last update">
        <dl className="space-y-4 text-sm"><div><dt className="font-medium text-slate-200">Source</dt><dd className="mt-1 text-slate-400">{data.coverage.source}</dd></div><div><dt className="font-medium text-slate-200">Last imported</dt><dd className="mt-1 tabular-nums text-slate-400">{data.coverage.importedAt.slice(0, 10)}</dd></div><div><dt className="font-medium text-slate-200">Coverage</dt><dd className="mt-1 leading-relaxed text-slate-400">{data.coverage.note}</dd></div><div><dt className="font-medium text-slate-200">Calculations</dt><dd className="mt-1 leading-relaxed text-slate-400">Per-game averages use published season totals divided by games played. Shooting percentages use total makes and attempts. The current season reflects the latest imported snapshot.</dd></div></dl>
      </ProfileAccordion>
    </section>
  );
}

export default async function NbaPlayerStatistics({ id, query }: { id: number; query: NbaStatsQuery }) {
  const result = await fetchNbaPlayerStatistics(id, query).catch(() => ({ status: "unavailable" as const }));
  if (result.status === "unavailable") return <StatsMessage id={id} text="NBA statistics are temporarily unavailable. Your player profile is still available; try loading statistics again." />;
  if (result.status === "ok") return <NbaPlayerStatisticsView data={result.data} expandGameLog={query.panel === "games"} />;
  return <StatsMessage id={id} text={result.status === "missing" ? "NBA statistics have not been imported for the selected season." : "Choose a valid season, competition, and game-log page."} />;
}
function StatsMessage({ id, text }: { id: number; text: string }) {
  return <section id="season-statistics" className="mt-6 scroll-mt-52 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:scroll-mt-32"><h2 className="text-xl font-bold">Season statistics</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">{text}</p><Link href={`/leagues/nba/players/${id}#season-statistics`} className="mt-4 inline-block text-sm text-blue-300">Load latest available statistics</Link></section>;
}
