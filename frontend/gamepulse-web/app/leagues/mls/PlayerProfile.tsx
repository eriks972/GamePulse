import Link from "next/link";
import { ProfileAccordion, ProfileMetrics, ProfileSeasonSwitch } from "@/app/leagues/PlayerProfileUI";
import type { MlsSeason } from "@/lib/mls";
import { playerMetricItems, playerSeasonStats, statisticLabel } from "@/lib/mls-player-profile";

const panel = "min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6";
const link = "font-semibold text-cyan-300 hover:underline";
const input = "min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const format = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);

export function MlsPlayerProfile({ data, seasons, id, phase = "Regular Season" }: {
  data: MlsSeason; seasons: number[]; id?: string; phase?: string;
}) {
  const player = data.players.find(p => p.id === id);
  const season = String(data.season);
  const path = player ? `/leagues/mls/players/${encodeURIComponent(player.id)}` : "/leagues/mls/players";
  const href = (page: string) => `/leagues/mls/${page}?season=${season}`;
  if (!player) return <section className={panel} role="status">
    <h1 className="text-2xl font-bold">Player not found in {season}</h1>
    <p className="mt-3 text-slate-400">This player is not in the imported catalog for the selected season. Browse that season’s players or choose another season.</p>
    <div className="mt-5"><ProfileSeasonSwitch league="MLS" seasons={seasons.map(String)} season={season} action={id ? `/leagues/mls/players/${encodeURIComponent(id)}` : path} query={{ seasonType: phase }} /></div>
  </section>;
  const row = playerSeasonStats(data, player.id, phase);
  const available = !!row && Object.values(row.statistics).some(n => n !== null);
  const teams = data.teams.filter(t => t.id === player.teamId || (player as typeof player & { observedTeamIds?: string[] }).observedTeamIds?.includes(t.id));
  const phases = [...new Set(["Regular Season", "Playoffs", ...data.playerStats.map(s => s.seasonType || "Regular Season"), phase])];
  const statPhases = data.playerStats.filter(s => s.id === player.id && Object.values(s.statistics).some(n => n !== null)).map(s => s.seasonType || "Regular Season");
  const comparison = `/leagues/mls/compare?${new URLSearchParams({ season, kind: "players", left: player.id, seasonType: phase })}`;
  return <>
    <ProfileSeasonSwitch league="MLS" seasons={seasons.map(String)} season={season} action={path} query={{ seasonType: phase }} />
    <section className={`${panel} bg-linear-to-br from-slate-900 to-cyan-950/20`}>
      <p className="text-xs uppercase tracking-widest text-cyan-300">MLS · Player profile · {season}</p>
      <h1 className="mt-4 break-words text-3xl font-black sm:text-4xl">{player.name}</h1>
      <p className="mt-3 text-slate-400">{player.position || "Position unavailable"}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm"><span className="text-slate-400">Observed season association</span>{teams.length ? teams.map(t => <Link key={t.id} href={href(`teams/${encodeURIComponent(t.id)}`)} className={link}>{t.name}</Link>) : <span className="text-slate-400">Team unavailable</span>}</div>
      <div className="mt-6 flex flex-wrap gap-5 text-sm"><Link className={link} href={comparison}>Compare this player →</Link><Link className={link} href={href("player-stats")+`&seasonType=${encodeURIComponent(phase)}`}>Player statistics →</Link></div>
    </section>
    <section id="season-statistics" className={`${panel} scroll-mt-40 space-y-6`}>
      <div><h2 className="text-2xl font-bold">Season statistics</h2><p className="mt-2 text-sm text-slate-400">{season} · {phase} · Imported season totals</p></div>
      <form action={path} className="flex max-w-full flex-wrap items-end gap-3">
        <input type="hidden" name="season" value={season} />
        <label className="grid gap-2 text-sm text-slate-300">Competition<select className={input} name="seasonType" defaultValue={phase}>{phases.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
        <button className="rounded-xl bg-cyan-400 px-5 py-2 font-bold text-slate-950 hover:bg-cyan-300">Load statistics</button>
      </form>
      {available ? <>
        <ProfileMetrics items={playerMetricItems(player, row)} />
        <p className="text-xs leading-relaxed text-slate-400">Games with statistics describes the imported coverage and may be less than the player’s full season. Dashes mean unavailable; zero means an observed zero. Season associations do not establish appearances or team-specific totals.</p>
      </> : <div role="status" className="rounded-xl border border-slate-700 p-4">
        <h3 className="font-semibold">Statistics unavailable for this selection</h3>
        <p className="mt-2 text-sm text-slate-400">The player profile is available, but no statistics have been imported for {phase.toLowerCase()} in {season}. A listed substitute is not proof of participation.</p>
        {statPhases.length > 0 && <div className="mt-3 flex flex-wrap gap-4">{statPhases.map(p => <Link key={p} className={`${link} text-sm`} href={`${path}?${new URLSearchParams({ season, seasonType: p })}`}>View {p.toLowerCase()} statistics →</Link>)}</div>}
      </div>}
    </section>
    {available && <ProfileAccordion title="Season breakdown" description="All imported statistics for the selected competition">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700 text-slate-400"><th scope="col" className="px-3 py-3">Statistic</th><th scope="col" className="px-3 py-3 text-right">Total</th></tr></thead><tbody>{Object.entries(row!.statistics).map(([key,n]) => <tr key={key} className="border-b border-slate-800"><th scope="row" className="px-3 py-3 font-medium">{statisticLabel(key)}</th><td className="px-3 py-3 text-right tabular-nums">{format(n)}</td></tr>)}</tbody></table></div>
    </ProfileAccordion>}
    <ProfileAccordion title="Coverage and player identity" description="How to interpret this season’s player statistics">
      <p className="text-sm leading-relaxed text-slate-400">Statistics are season-wide for this player and competition. Transfers do not split the imported totals into team contributions. Missing minutes, goalkeeper fields, or other measurements remain unavailable.</p>
      <p className="text-sm leading-relaxed text-slate-400">Season totals do not supply a match-by-match player log. Historical archive identities and ESPN identities remain separate until a verified crosswalk is available.</p>
      <p className="break-all text-xs text-slate-500">Player reference: {player.id}</p>
    </ProfileAccordion>
  </>;
}
