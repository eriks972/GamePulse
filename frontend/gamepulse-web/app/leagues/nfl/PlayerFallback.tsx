import { nfl, nflHref, nflEntity, phaseName, statGroups, display, NflApiError, type NflPlayerDetail, type NflTeam } from "@/lib/nfl";
import { ProfileAccordion } from "../PlayerProfileUI";

// Older API deployments have player details but no season-profile/season-log
// routes. Only a 404 from those routes invokes this path; outages still surface.
export async function PlayerFallback({ season, id, query }: { season: string; id: string; query: Record<string, string> }) {
  const phase = query.seasonType || "REG";
  let group = query.statGroup || query.group || "passing";
  if (!["REG", "POST"].includes(phase) || !Object.hasOwn(statGroups, group)) throw new NflApiError(400);
  const [detail, teams] = await Promise.all([
    nfl<NflPlayerDetail>(nflEntity("players", id), { season }),
    nfl<NflTeam[]>("teams", { season }),
  ]);
  if(!query.statGroup && !query.group) { const position=detail.player.position; group=position==="QB"?"passing":["RB","FB"].includes(position||"")?"rushing":["WR","TE"].includes(position||"")?"receiving":["K","P"].includes(position||"")?"kicking":"defense"; }
  const path = nflHref(nflEntity("players", id));
  const rows = detail.statistics.filter(s => s.seasonType === phase && (!query.teamId || s.teamId === query.teamId));
  const rawPage = Number(query.page || "1");
  if (!Number.isSafeInteger(rawPage) || rawPage < 1) throw new NflApiError(400);
  const page = Math.min(rawPage, Math.max(1, Math.ceil(rows.length / 10)));
  const pageHref = (target: number) => `${path}?${new URLSearchParams({ season, seasonType: phase, statGroup: group, teamId: query.teamId || "", page: String(target), panel: "games" })}#game-log`;
  return <>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
      <p className="text-xs uppercase tracking-widest text-blue-300">NFL · Player profile · {season}</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">{detail.player.name || id}</h1>
      <p className="mt-3 text-sm text-slate-400">{detail.player.position || "Position unavailable"} · GSIS {detail.player.playerId}</p>
      <div className="mt-4 flex flex-wrap gap-4">{detail.player.teamIds.map(t => <a key={t} className="text-sm text-blue-300 hover:underline" href={nflHref(nflEntity("teams", t), { season })}>{teams.find(team => team.teamId === t)?.name || t}</a>)}</div>
    </section>
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-xl font-bold">Season statistics</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">Season summaries are unavailable from the current NFL service. Available weekly source rows appear below. Roster membership alone does not establish appearances or zero production.</p>
      <form action={path} className="mt-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="season" value={season} />
        <label className="grid gap-2 text-sm">Season type<select name="seasonType" defaultValue={phase} className="rounded-xl border border-slate-700 bg-slate-950 p-2"><option value="REG">Regular season</option><option value="POST">Postseason</option></select></label>
        <label className="grid gap-2 text-sm">Game-log category<select name="statGroup" defaultValue={group} className="rounded-xl border border-slate-700 bg-slate-950 p-2">{Object.entries(statGroups).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="grid gap-2 text-sm">Team contributions<select name="teamId" defaultValue={query.teamId || ""} className="max-w-full rounded-xl border border-slate-700 bg-slate-950 p-2"><option value="">All teams</option>{teams.filter(t => detail.player.teamIds.includes(t.teamId)).map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>
        <button className="rounded-xl bg-blue-500 px-4 py-2 font-bold">Apply filters</button>
      </form>
    </section>
    <ProfileAccordion id="game-log" title="Game log" description={`${phaseName(phase)} · ${statGroups[group].label} · ${rows.length} source rows`} defaultOpen={query.panel === "games" || page > 1}>
      {!rows.length ? <p className="text-sm text-slate-400">No weekly player statistics recorded for this selection. A roster entry is available below.</p> : <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="Weekly statistics, scroll horizontally"><table className="w-full text-sm"><thead><tr>{["Game", "Week", "Team", ...statGroups[group].columns.map(c => c[1])].map(l => <th key={l} scope="col" className="whitespace-nowrap p-3 text-right first:text-left">{l}</th>)}</tr></thead><tbody>{rows.slice((page - 1) * 10, page * 10).map((s, i) => <tr className="border-t border-slate-800" key={`${s.gameId}-${s.teamId}-${i}`}><th scope="row" className="whitespace-nowrap p-3 text-left"><a className="text-blue-300" href={nflHref(nflEntity("game", s.gameId), { season, statGroup: group })}>{s.teamId} vs {s.opponentTeamId}</a></th><td className="p-3 text-right">{s.week}</td><td className="p-3 text-right">{s.teamId}</td>{statGroups[group].columns.map(([k]) => <td key={k} className="p-3 text-right tabular-nums">{display(s.stats[k])}</td>)}</tr>)}</tbody></table></div>}
      <nav aria-label="Weekly statistics pagination" className="flex flex-wrap gap-4 text-sm"><span>Page {page} of {Math.max(1, Math.ceil(rows.length / 10))}</span>{page > 1 && <a href={pageHref(page - 1)}>← Previous</a>}{page * 10 < rows.length && <a href={pageHref(page + 1)}>Next →</a>}</nav>
    </ProfileAccordion>
    <ProfileAccordion title="Roster details" description="Season roster associations; these do not confirm participation">
      {detail.rosters.map((r,i) => <div key={`${r.teamId}-${i}`} className="rounded-xl border border-slate-800 p-4"><p className="font-semibold">{teams.find(t => t.teamId === r.teamId)?.name || r.teamId}</p><p className="mt-2 text-sm text-slate-400">{r.position || "Position unavailable"} · Jersey {r.jerseyNumber ?? "—"} · Source roster status {r.status || "—"}</p></div>)}
      {!detail.rosters.length && <p className="text-sm text-slate-400">No roster snapshot available.</p>}
    </ProfileAccordion>
  </>;
}
