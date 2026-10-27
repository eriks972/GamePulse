"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><h1 className="text-3xl font-black">NFL view could not load</h1><p className="mt-4 text-slate-400">Try loading this page again.</p><div className="mt-6 flex gap-5"><button onClick={reset} className="rounded-xl bg-blue-500 px-4 py-2 font-bold">Try again</button><Link className="py-2 text-blue-300" href="/leagues/nfl">NFL overview</Link></div></main>; }
