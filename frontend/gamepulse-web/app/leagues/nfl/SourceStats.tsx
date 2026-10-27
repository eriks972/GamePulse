"use client";
import { useState } from "react";
import { display, type NflStat } from "@/lib/nfl";

// Render one source row on demand instead of thousands of hidden field elements.
export function SourceStats({ rows }: { rows: NflStat[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const selected = rows[index];
  return <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-6">
    <button className="text-left font-bold text-blue-300 hover:text-blue-200" aria-expanded={open} aria-controls="nfl-source-values" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} All source statistics for this game</button>
    {open && <div id="nfl-source-values" role="region" aria-label="All source field values">
      <p className="mt-3 text-sm leading-6 text-slate-400">Original source field names and values, including unavailable values. No season totals or rates are inferred.</p>
      {!rows.length ? <p className="mt-4 text-slate-400">No source statistics are available for this game.</p> : <>
        <label className="mt-5 grid gap-2 text-sm text-slate-300">Player or team row
          <select className="min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" value={index} onChange={e => setIndex(Number(e.target.value))}>
            {rows.map((r, i) => <option key={i} value={i}>{r.name || "Team totals"} · {r.teamId}{r.position ? ` · ${r.position}` : ""}</option>)}
          </select>
        </label>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(selected.stats).map(([key, value]) => <div key={key} className="min-w-0 rounded-lg bg-slate-950 p-3"><dt className="break-words text-xs text-slate-400">{key}</dt><dd className="mt-2 break-words font-semibold tabular-nums">{display(value)}</dd></div>)}</dl>
      </>}
    </div>}
  </section>;
}
