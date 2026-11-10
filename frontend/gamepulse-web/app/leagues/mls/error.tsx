"use client";
export default function Error({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-6xl space-y-4 px-6 py-10"><h1 className="text-2xl font-bold">MLS data is unavailable</h1><p>Please try again later.</p><button onClick={reset} className="rounded-xl bg-cyan-400 px-5 py-2 font-bold text-slate-950 hover:bg-cyan-300">Try again</button></main>; }
