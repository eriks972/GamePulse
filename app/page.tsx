import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-4xl border border-slate-800 bg-linear-to-br from-slate-900 via-slate-900 to-blue-950/40 p-8 shadow-xl md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">
            GamePulse
          </p>

          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
            Sports analytics built for fans, comparisons, and data-driven
            insights.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            GamePulse is a multi-sport analytics platform starting with NBA
            coverage. The MVP focuses on teams, schedules, standings,
            comparisons, and analytics before adding premium live features.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/leagues/nba"
              className="rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
            >
              Open NBA Dashboard
            </Link>

            <Link
              href="/leagues/nba/compare"
              className="rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10"
            >
              Compare Teams
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">What is GamePulse?</h2>
            <p className="mt-3 text-slate-400">
              GamePulse is a sports analytics platform starting with NBA data.
              It combines historical schedules, team records, player profiles, game breakdowns, comparisons, and interactive analytics dashboards.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">Analytics Focused</h2>
            <p className="mt-3 text-slate-400">
              The platform is designed to go beyond scores by adding rankings,
              matchup context, and custom metrics.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">Built to Expand</h2>
            <p className="mt-3 text-slate-400">
              The structure supports adding NFL, MLB, NHL, WNBA, and other
              leagues later.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
