import Link from "next/link";
import { getNbaGames, getNbaTeams } from "@/lib/api";

export default async function NbaLandingPage() {
  const teams = await getNbaTeams();
  const games = await getNbaGames();

  const sortedTeams = [...teams].sort((a, b) => {
    const winPctA = a.wins / (a.wins + a.losses);
    const winPctB = b.wins / (b.wins + b.losses);
    return winPctB - winPctA;
  });

  const topTeam = sortedTeams[0];
  const recentFinals = games.filter((game) => game.status === "Final").slice(0, 2);
  const upcomingGames = games.filter((game) => game.status !== "Final").slice(0, 2);

  const navCards = [
    {
      title: "Teams",
      description: "Explore NBA teams, conferences, divisions, and records.",
      href: "/leagues/nba/teams",
      label: "View Teams",
    },
    {
      title: "Schedule & Results",
      description: "Browse recent final scores and upcoming NBA matchups.",
      href: "/leagues/nba/schedule",
      label: "View Schedule",
    },
    {
      title: "Standings",
      description: "Rank NBA teams by record and win percentage.",
      href: "/leagues/nba/standings",
      label: "View Standings",
    },
    {
      title: "Compare Teams",
      description: "Compare two teams side by side using record-based metrics.",
      href: "/leagues/nba/compare",
      label: "Compare Teams",
    },
    {
      title: "Analytics",
      description: "Review early strength scores and future analytics previews.",
      href: "/leagues/nba/analytics",
      label: "View Analytics",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-4xl border border-slate-800 bg-linear-to-br from-slate-900 via-slate-900 to-blue-950/40 p-8 shadow-xl md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">
            GamePulse NBA
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                NBA Dashboard
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Explore NBA teams, schedules, standings, comparisons, and early
                analytics inside the first league section of the GamePulse
                sports platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/leagues/nba/teams"
                  className="rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
                >
                  Explore Teams
                </Link>

                <Link
                  href="/leagues/nba/analytics"
                  className="rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10"
                >
                  View Analytics
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
                Current Top Team
              </p>

              <h2 className="mt-4 text-3xl font-black">{topTeam.name}</h2>

              <p className="mt-2 text-slate-300">
                {topTeam.city} · {topTeam.conference} Conference
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Record</p>
                  <p className="mt-2 text-2xl font-bold">
                    {topTeam.wins}-{topTeam.losses}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Division</p>
                  <p className="mt-2 text-2xl font-bold">
                    {topTeam.division}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {navCards.map((card) => (
            <Link
              href={card.href}
              key={card.title}
              className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl transition hover:-translate-y-1 hover:border-blue-500"
            >
              <h2 className="text-xl font-bold">{card.title}</h2>

              <p className="mt-3 min-h-20 text-sm leading-6 text-slate-400">
                {card.description}
              </p>

              <p className="mt-5 text-sm font-bold text-blue-300">
                {card.label} →
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Recent Results</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Latest completed games in the mock dataset.
                </p>
              </div>

              <Link
                href="/leagues/nba/schedule"
                className="text-sm font-bold text-blue-300 hover:text-blue-200"
              >
                View all
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {recentFinals.map((game) => (
                <div
                  key={game.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {new Date(game.gameDate).toLocaleDateString()}
                    </p>

                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
                      {game.status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{game.awayTeamName}</p>
                      <p className="text-sm text-slate-500">
                        {game.awayTeamAbbreviation}
                      </p>
                    </div>
                    <p className="text-2xl font-black">{game.awayScore}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{game.homeTeamName}</p>
                      <p className="text-sm text-slate-500">
                        {game.homeTeamAbbreviation}
                      </p>
                    </div>
                    <p className="text-2xl font-black">{game.homeScore}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Upcoming Games</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Scheduled games without live tracking.
                </p>
              </div>

              <Link
                href="/leagues/nba/schedule"
                className="text-sm font-bold text-blue-300 hover:text-blue-200"
              >
                View all
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {upcomingGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <p className="text-sm text-slate-400">
                    {new Date(game.gameDate).toLocaleDateString()}
                  </p>

                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div>
                      <p className="font-bold">{game.awayTeamAbbreviation}</p>
                      <p className="text-sm text-slate-500">Away</p>
                    </div>

                    <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">
                      at
                    </p>

                    <div className="text-right">
                      <p className="font-bold">{game.homeTeamAbbreviation}</p>
                      <p className="text-sm text-slate-500">Home</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
              <h3 className="font-bold text-blue-200">MVP Strategy</h3>
              <p className="mt-2 text-sm leading-6 text-blue-100/80">
                GamePulse starts with stable team, schedule, standings, and
                analytics data. Live sports features can be added later as a
                premium product layer.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}