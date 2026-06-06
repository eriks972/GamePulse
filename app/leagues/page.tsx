import Link from "next/link";
export default function LeaguesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <Link
                href={`/leagues/nba`}
                key="nba"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg transition hover:-translate-y-1 hover:border-blue-500"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">NBA</h2>

                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-300">
                    Basketball
                  </span>
                </div>

                <p className="mt-2 text-slate-400">National Basketball Association</p>

                {/* <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Conference</p>
                    <p className="font-semibold">{team.conference}</p>
                  </div>

                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Division</p>
                    <p className="font-semibold">{team.division}</p>
                  </div>
                </div> */}

                <div className="mt-5 flex items-center justify-between">
                  {/* <p className="text-lg font-bold">
                    {team.wins}-{team.losses}
                  </p> */}

                  <p className="text-sm font-semibold text-blue-300">
                    View League →
                  </p>
                </div>
              </Link>
          </div>
      </section>
    </main>
  );
}   