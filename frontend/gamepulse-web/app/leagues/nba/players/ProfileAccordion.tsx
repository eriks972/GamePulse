import type { ReactNode } from "react";

export default function ProfileAccordion({ title, description, children, id, defaultOpen = false }: {
  title: string; description: string; children: ReactNode; id?: string; defaultOpen?: boolean;
}) {
  return (
    <details id={id} open={defaultOpen} className="group min-w-0 scroll-mt-52 rounded-2xl border border-slate-800 bg-slate-900/60 open:border-slate-700 md:scroll-mt-32">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-4 outline-none transition hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0"><span className="block text-base font-semibold text-slate-100">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-400">{description}</span></span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="min-w-0 border-t border-slate-800 px-4 py-5 sm:px-5">{children}</div>
    </details>
  );
}
