import Link from "next/link";
import { wnba, wnbaHref, entityPath, gameDate, statValue, WnbaApiError,
  type WnbaTeam, type WnbaComparison, type WnbaComparisonTeam } from "@/lib/wnba";
import { comparisonRows, type ComparisonBasis, type ComparisonRow } from "@/lib/wnba-comparison";
import type { Query } from "./Views";

const panel = "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl";
const input = "max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const link = "font-semibold text-blue-300 hover:text-blue-200 hover:underline";
const value = (query: Query, key: string) => typeof query[key] === "string" ? query[key] as string : "";
const teamName = (t: WnbaTeam) => t.name || t.abbreviation || "Team name unavailable";
const percent = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;

function TeamCard({ side, season }: { side: WnbaComparisonTeam; season: string }) {
  const record = side.record, stats = side.seasonStatistics;
  return <section className={panel}><p className="text-sm font-semibold text-blue-400">{side.team.abbreviation || "WNBA"}</p>
    <h2 className="mt-3 text-2xl font-black"><Link className={link} href={wnbaHref(entityPath("teams", side.team.id), season)}>{teamName(side.team)}</Link></h2>
    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-950 p-4"><p className="text-sm text-slate-400">Calculated record</p>
      <p className="mt-2 text-3xl font-black">{record.wins}–{record.losses}</p><p className="mt-1 text-xs text-slate-500">{record.games} valid-score games</p></div>
      <div className="rounded-2xl bg-slate-950 p-4"><p className="text-sm text-slate-400">Win percentage</p><p className="mt-2 text-3xl font-black">{percent(record.winPercentage)}</p></div>
    </div><div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300"><p>Home {record.homeWins}–{record.homeLosses}</p><p>Away {record.awayWins}–{record.awayLosses}</p></div>
    <p className="mt-4 text-sm text-slate-400">{record.completedGames}/{record.scheduledGames} scheduled games marked complete · Score coverage {record.games}/{record.completedGames}</p>
    <p className="mt-2 text-sm text-slate-400">Box coverage {stats.teamStatsGames}/{stats.completedGames} · Opponent box coverage {stats.opponentStatsGames}/{stats.completedGames}</p>
    {record.excludedCompletedGames > 0 && <p className="mt-3 text-sm text-amber-300">{record.excludedCompletedGames} completed games excluded from the record because final scores are missing, invalid, or tied.</p>}
    {stats.scoreDiscrepancyGames > 0 && <p className="mt-3 text-sm text-amber-300">{stats.scoreDiscrepancyGames} box/schedule score discrepancies.</p>}
  </section>;
}

function StatCell({ row, side, basis }: { row: ComparisonRow; side: "a" | "b"; basis: ComparisonBasis }) {
  const observation = row[side];
  const display = observation.value == null ? "—" : row.percentage ? percent(observation.value) :
    basis === "perGame" ? observation.value.toFixed(1) : statValue(observation.value);
  return <td className={`p-3 text-right tabular-nums ${row.advantage === side ? "bg-emerald-500/5 text-emerald-300" : "text-slate-200"}`} data-advantage={row.advantage === side ? "true" : undefined}>
    <span className="font-bold">{display}</span>{row.advantage === side && <span className="sr-only">, favorable value with complete coverage</span>}
    <span className="mt-1 block text-xs text-slate-500">{observation.games}/{observation.completed} games</span>
  </td>;
}

export async function ComparisonView({ season, query }: { season: string; query: Query }) {
  const teams = await wnba<WnbaTeam[]>("teams", { season });
  if (teams.length < 2) return <section className={panel}><h2 className="text-2xl font-bold">Two teams are needed</h2><p className="mt-3 text-slate-400">This imported season does not contain enough teams for a comparison.</p></section>;
  const resolve = (id: string) => teams.find(t => t.id === id || t.id.split(":").at(-1) === id);
  const a = value(query, "teamA") ? resolve(value(query, "teamA")) : teams[0];
  const b = value(query, "teamB") ? resolve(value(query, "teamB")) : teams.find(t => t.id !== a?.id);
  const seasonType = value(query, "seasonType") === "Playoffs" ? "Playoffs" : "Regular Season";
  const basis: ComparisonBasis = value(query, "basis") === "total" ? "total" : "perGame";
  const filters = { season, seasonType, basis, teamA: a?.id || "", teamB: b?.id || "" };
  const href = (left: string, right: string) => `${wnbaHref("compare")}?${new URLSearchParams({ ...filters, teamA: left, teamB: right })}`;
  let error = !a || !b ? "A selected team is unavailable in this season. Choose two available teams." :
    a.id === b.id ? "Choose two different teams to compare." : "";
  let data: WnbaComparison | null = null;
  if (!error) {
    try { data = await wnba<WnbaComparison>("compare", filters); }
    catch (failure) {
      if (failure instanceof WnbaApiError && failure.status === 404) throw new WnbaApiError(503);
      throw failure;
    }
  }
  // Keep input errors beside the selectors so the user can immediately change them.
  if (!data && !error) error = "Comparison data is unavailable right now.";
  return <>
    <form key={[season, a?.id, b?.id, seasonType, basis].join("|")} action={wnbaHref("compare")} className={`${panel} flex flex-wrap items-end gap-4`}>
      <input type="hidden" name="season" value={season} />
      {[["teamA", "Team A", a?.id], ["teamB", "Team B", b?.id]].map(([key, label, selected]) => <label className="grid min-w-0 gap-2 text-sm text-slate-300" key={key}>{label}
        <select className={input} name={key} defaultValue={selected || ""}><option value="" disabled>Choose a team</option>
          {teams.map(t => <option key={t.id} value={t.id}>{teamName(t)}</option>)}</select></label>)}
      <label className="grid gap-2 text-sm text-slate-300">Season type<select className={input} name="seasonType" defaultValue={seasonType}><option>Regular Season</option><option>Playoffs</option></select></label>
      <label className="grid gap-2 text-sm text-slate-300">Display<select className={input} name="basis" defaultValue={basis}><option value="perGame">Per game</option><option value="total">Totals</option></select></label>
      <button className="rounded-xl bg-blue-500 px-5 py-2 font-bold hover:bg-blue-400">Compare teams</button>
      {a && b && a.id !== b.id && <Link className={link} href={href(b.id, a.id)}>Swap teams</Link>}
    </form>
    {error && <section className={panel} role="alert"><p className="text-amber-300">{error}</p></section>}
    {data && <>
      <div className="grid gap-5 md:grid-cols-2"><TeamCard side={data.teamA} season={season} /><TeamCard side={data.teamB} season={season} /></div>
      <section className={panel}><h2 className="text-2xl font-bold">{seasonType} comparison · {basis === "total" ? "Totals" : "Per game"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">Green marks a favorable recorded value with complete coverage for both teams. Lower is favorable for opponent points and turnovers. Totals also require equal contributing game counts. Equal values and incomplete samples are not highlighted.</p>
        <p className="mt-2 text-xs text-slate-500">Scroll horizontally to view the table on smaller screens. Counts show observed games / games marked complete.</p>
        <div className="relative mt-5 overflow-x-auto" role="region" aria-label="Team comparison statistics, scroll horizontally" tabIndex={0}>
          <table className="w-full text-left text-sm"><caption className="sr-only">WNBA {season} team comparison</caption>
            <thead className="text-slate-400"><tr><th scope="col" className="min-w-40 p-3">Statistic</th><th scope="col" className="min-w-36 p-3 text-right">{teamName(data.teamA.team)}</th><th scope="col" className="min-w-36 p-3 text-right">{teamName(data.teamB.team)}</th></tr></thead>
            <tbody>{comparisonRows(data, basis).map(row => <tr className="border-t border-slate-800" key={row.key} data-metric={row.key}>
              <th scope="row" className="p-3 font-semibold">{row.label}{row.lowerIsBetter && <span className="mt-1 block text-xs font-normal text-slate-500">Lower is favorable</span>}</th>
              <StatCell row={row} side="a" basis={basis} /><StatCell row={row} side="b" basis={basis} />
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-400">Records and schedule margins use valid completed final scores. Other metrics use available team/opponent box scores; each average has its own observed-game denominator. Shooting uses paired summed makes/attempts and stays a percentage in Totals mode. Coverage refers to the imported snapshot. Colors describe these values, not a game prediction.</p>
      </section>
      <section className={panel}><h2 className="text-2xl font-bold">Head-to-head · {seasonType}</h2>
        <p className="mt-3 text-lg font-bold">{teamName(data.teamA.team)} {data.headToHead.teamAWins}–{data.headToHead.teamBWins} {teamName(data.teamB.team)}</p>
        <p className="mt-2 text-sm text-slate-400">{data.headToHead.countedGames} valid-score games counted · {data.headToHead.completedGames} marked complete · {data.headToHead.scheduledGames} imported matchups</p>
        {data.headToHead.excludedCompletedGames > 0 && <p className="mt-2 text-sm text-amber-300">{data.headToHead.excludedCompletedGames} completed matchups excluded from the record because scores are missing, invalid, or tied.</p>}
        {!data.headToHead.games.length ? <p className="mt-5 rounded-xl bg-slate-950 p-5 text-slate-400">No head-to-head games in the imported schedule for this season type.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">
          {data.headToHead.games.map(game => <Link className="rounded-2xl border border-slate-800 bg-slate-950 p-5 hover:border-blue-400" key={game.id} href={wnbaHref(`game/${encodeURIComponent(game.id)}`, season)}>
            <div className="flex justify-between gap-3 text-sm text-slate-400"><span>{gameDate(game.gameDate)}</span><span>{game.status}</span></div>
            <p className="mt-4 flex justify-between gap-4 font-bold"><span>{game.awayTeamName || "Away team"}</span><span>{statValue(game.awayScore)}</span></p>
            <p className="mt-3 flex justify-between gap-4 font-bold"><span>{game.homeTeamName || "Home team"}</span><span>{statValue(game.homeScore)}</span></p>
            <p className="mt-4 text-sm font-semibold text-blue-300">Game details →</p>
          </Link>)}
        </div>}
      </section>
    </>}
  </>;
}
