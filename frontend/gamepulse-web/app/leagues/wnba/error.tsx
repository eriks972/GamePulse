"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto min-h-[60vh] max-w-6xl px-6 py-16">
    <h1 className="text-3xl font-black">This WNBA page could not be loaded</h1>
    <p className="mt-4 text-slate-400">Please try again in a moment.</p>
    <div className="mt-6 flex items-center gap-5">
      <button onClick={reset} className="rounded-xl bg-blue-500 px-5 py-2 font-bold hover:bg-blue-400">Try again</button>
      <Link href="/leagues/wnba" className="text-blue-300">WNBA overview</Link>
    </div>
  </main>;
}
