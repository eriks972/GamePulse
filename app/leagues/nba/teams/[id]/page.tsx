import Link from "next/link";
import { getNbaTeamById } from "@/lib/api";

type TeamDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id } = await params;
  const team = await getNbaTeamById(id);

  const totalGames = team.wins + team.losses;
  const winPercentage =
    totalGames > 0 ? ((team.wins / totalGames) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <Link
          href="/leagues/nba/teams"
          className="text-sm font-semibold text-blue-400 hover:text-blue-300"
        >
          ← Back to NBA Teams
        </Link>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
                {team.conference} Conference
              </p>

              <h1 className="mt-3 text-4xl font-bold">{team.name}</h1>

              <p className="mt-3 text-lg text-slate-300">
                {team.city} · {team.division} Division
              </p>
            </div>

            <div className="rounded-2xl bg-blue-500/10 px-6 py-4 text-center">
              <p className="text-sm text-blue-300">Abbreviation</p>
              <p className="text-3xl font-black text-blue-200">
                {team.abbreviation}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Record</p>
              <p className="mt-2 text-3xl font-bold">
                {team.wins}-{team.losses}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Win Percentage</p>
              <p className="mt-2 text-3xl font-bold">{winPercentage}%</p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">League</p>
              <p className="mt-2 text-3xl font-bold uppercase">
                {team.leagueSlug}
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-bold">Analytics Preview</h2>
            <p className="mt-3 text-slate-300">
              This section will eventually include team efficiency, player
              dependency score, recent results, roster balance, and matchup
              comparison data.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}