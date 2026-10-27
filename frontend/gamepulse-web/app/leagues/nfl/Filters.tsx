"use client";
import { useState } from "react";
import { nflHref, phaseName, type NflReport, type NflTeam } from "@/lib/nfl";
const input = "min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
export function Filters({ season, path, teams, report, query, players = false, statistics = false, standings = false }: {
  season: string; path: string; teams: NflTeam[]; report: NflReport; query: Record<string, string>; players?: boolean; statistics?: boolean; standings?: boolean;
}) {
  const [phase, setPhase] = useState(query.seasonType || (standings ? "REG" : ""));
  const [week, setWeek] = useState(query.week || "");
  const weeks = [...new Set(report.phases.filter(p => !phase || p.seasonType === phase).flatMap(p => p.weeks))].sort((a, b) => a - b);
  return <form action={nflHref(path)} className="flex flex-wrap items-end gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5">
    <input type="hidden" name="season" value={season} />
    {statistics && <input type="hidden" name="statGroup" value={query.statGroup || "passing"} />}
    {!standings && <label className="grid min-w-0 gap-2 text-sm text-slate-300">Team<select className={input} name="teamId" defaultValue={query.teamId || ""}><option value="">All teams</option>{teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label>}
    {(players || statistics) && <label className="grid min-w-0 gap-2 text-sm text-slate-300">{players ? "Player name" : "Player name / team code"}<input className={input} name="search" defaultValue={query.search || ""} placeholder="Search" /></label>}
    {players && <label className="grid min-w-0 gap-2 text-sm text-slate-300">Position<input className={input} name="position" defaultValue={query.position || ""} placeholder="e.g. QB" size={8} /></label>}
    {!players && <>
      <label className="grid gap-2 text-sm text-slate-300">Season type<select name="seasonType" className={input} value={phase} onChange={e => { setPhase(e.target.value); setWeek(""); }}>{!standings && <option value="">All types</option>}{[...new Set(["REG", "POST", ...report.phases.map(p => p.seasonType)])].map(p => <option key={p} value={p}>{phaseName(p)}</option>)}</select></label>
      {!standings && <label className="grid gap-2 text-sm text-slate-300">Source week<select name="week" className={input} value={week} onChange={e => setWeek(e.target.value)}><option value="">All weeks</option>{weeks.map(w => <option key={w} value={w}>Week {w}</option>)}</select></label>}
      {!statistics && !standings && <label className="grid gap-2 text-sm text-slate-300">Result<select name="status" className={input} defaultValue={query.status || ""}><option value="">All games</option><option value="final">Final</option><option value="scheduled">No final score</option></select></label>}
    </>}
    <button className="rounded-xl bg-blue-500 px-5 py-2 font-bold text-white hover:bg-blue-400">Apply filters</button>
    <a className="py-2 text-sm font-semibold text-blue-300 hover:underline" href={nflHref(path, { season })}>Reset</a>
  </form>;
}
