import type { ReactNode } from "react";

export function ProfileAccordion({ title, description, children, id, defaultOpen = false }: {
  title: string; description: string; children: ReactNode; id?: string; defaultOpen?: boolean;
}) {
  return <details id={id} open={defaultOpen} className="group min-w-0 scroll-mt-52 rounded-2xl border border-slate-800 bg-slate-900/60 open:border-slate-700 md:scroll-mt-32">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-4 outline-none hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-5 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="block font-semibold text-slate-100">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-400">{description}</span></span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="min-w-0 space-y-5 border-t border-slate-800 p-4 sm:p-5 [&_section]:rounded-none [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0 [&_section]:shadow-none [&_aside]:rounded-none [&_aside]:border-0 [&_aside]:bg-transparent [&_aside]:p-0">{children}</div>
  </details>;
}

export function ProfileMetrics({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{items.map(({ label, value }) =>
    <div key={label} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><dt className="text-xs leading-relaxed text-slate-400">{label}</dt><dd className="mt-3 break-words text-2xl font-bold tabular-nums text-slate-100">{value ?? "—"}</dd></div>
  )}</dl>;
}

export function ProfileSeasonSwitch({ league, seasons, season, action, query = {}, endingYear = false }: {
  league: string; seasons: string[]; season: string; action: string;
  query?: Record<string, string | string[] | undefined>; endingYear?: boolean;
}) {
  return <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
    <a href={`/leagues/${league.toLowerCase()}/players?season=${encodeURIComponent(season)}`} className="py-3 text-sm text-slate-400 hover:text-white">← Back to {league} players</a>
    <form action={action.split("?")[0]} className="flex max-w-full flex-wrap items-end gap-3">
      {["seasonType", "group", "statGroup"].map(key => typeof query[key] === "string" && <input key={key} type="hidden" name={key} value={query[key]} />)}
      <label className="grid gap-2 text-xs text-slate-400">{endingYear ? "Season (ending year)" : "Season"}<select name="season" defaultValue={season} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{seasons.map(s => <option key={s} value={s}>{endingYear ? `${Number(s) - 1}–${s.slice(-2)}` : s}</option>)}</select></label>
      <button className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-blue-400">Load season</button>
    </form>
  </div>;
}
