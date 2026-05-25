import Link from "next/link";
import { getNbaTeams } from "@/lib/api";

export default async function NbaAnalyticsPage() {
  const teams = await getNbaTeams();

  const enrichedTeams = teams
    .map((team) => {
      const totalGames = team.wins + team.losses;
      const winPercentage = totalGames > 0 ? team.wins / totalGames : 0;

      // Temporary MVP metric until we add real efficiency data.
      const strengthScore = Math.round(winPercentage * 100);

      return {
        ...team,
        winPercentage,
        strengthScore,
      };
    })
    .sort((a, b) => b.strengthScore - a.strengthScore);

  const bestTeam = enrichedTeams[0];
  const mostLosses = [...enrichedTeams].sort((a, b) => b.losses - a.losses)[0];

  const easternTeams = teams.filter((team) => team.conference === "Eastern");
  const westernTeams = teams.filter((team) => team.conference === "Western");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA
            </p>

            <h1 className="mt-3 text-4xl font-bold">NBA Analytics</h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Explore early GamePulse analytics using team records, win
              percentages, conference distribution, and temporary strength
              scoring.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/leagues/nba/teams"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Teams
            </Link>

            <Link
              href="/leagues/nba/compare"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Compare
            </Link>

            <Link
              href="/leagues/nba/standings"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Standings
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Top Team</p>
            <h2 className="mt-3 text-2xl font-bold">{bestTeam.name}</h2>
            <p className="mt-2 text-blue-300">
              {bestTeam.wins}-{bestTeam.losses}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Best Strength Score</p>
            <h2 className="mt-3 text-4xl font-black text-blue-300">
              {bestTeam.strengthScore}
            </h2>
            <p className="mt-2 text-slate-400">MVP metric</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Eastern Teams</p>
            <h2 className="mt-3 text-4xl font-black">
              {easternTeams.length}
            </h2>
            <p className="mt-2 text-slate-400">In current dataset</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Western Teams</p>
            <h2 className="mt-3 text-4xl font-black">
              {westernTeams.length}
            </h2>
            <p className="mt-2 text-slate-400">In current dataset</p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold">Strength Rankings</h2>
              <p className="mt-2 text-sm text-slate-400">
                Temporary score based on win percentage. This will later be
                replaced with a deeper analytics model.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {enrichedTeams.map((team, index) => (
                <Link
                  href={`/leagues/nba/teams/${team.id}`}
                  key={team.id}
                  className="block rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-500"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-500">
                        #{index + 1}
                      </p>
                      <h3 className="mt-1 text-xl font-bold">{team.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {team.conference} · {team.division}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-black text-blue-300">
                        {team.strengthScore}
                      </p>
                      <p className="text-sm text-slate-500">score</p>
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${team.strengthScore}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-2xl font-bold">Current Insight</h2>
              <p className="mt-3 text-slate-300">
                Based on the current mock dataset,{" "}
                <span className="font-bold text-blue-300">
                  {bestTeam.name}
                </span>{" "}
                has the strongest record and highest MVP strength score.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-2xl font-bold">Watch Area</h2>
              <p className="mt-3 text-slate-300">
                <span className="font-bold text-blue-300">
                  {mostLosses.name}
                </span>{" "}
                currently has the most losses in the dataset. Later, this card
                can show struggling teams, injury impact, schedule difficulty,
                or recent form trends.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
              <h2 className="text-xl font-bold text-blue-200">
                Future Analytics Layer
              </h2>
              <p className="mt-3 text-sm leading-6 text-blue-100/80">
                This page will eventually include player dependency score, team
                efficiency rankings, roster balance, offensive/defensive
                metrics, and comparison-based insights from processed sports
                datasets.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}