import Link from "next/link";
import { getNbaGames } from "@/lib/api";

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function NbaSchedulePage() {
  const games = await getNbaGames();

  const finalGames = games.filter((game) => game.status === "Final");
  const upcomingGames = games.filter((game) => game.status !== "Final");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA
            </p>

            <h1 className="mt-3 text-4xl font-bold">Schedule & Results</h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              View NBA mock schedule data, final scores, and upcoming games
              served from the ASP.NET Core backend.
            </p>
          </div>

          <Link
            href="/leagues/nba/teams"
            className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
          >
            View NBA Teams
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Recent Results</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Completed games with final scores.
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
                  Final
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {finalGames.map((game) => {
                  const homeWon = game.homeScore > game.awayScore;
                  const awayWon = game.awayScore > game.homeScore;

                  return (
                    <article
                      key={game.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-400">
                            {formatGameDate(game.gameDate)}
                          </p>
                          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                            {game.season}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-300">
                          {game.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4">
                          <div>
                            <p
                              className={`text-lg font-bold ${
                                awayWon ? "text-white" : "text-slate-300"
                              }`}
                            >
                              {game.awayTeamName}
                            </p>
                            <p className="text-sm text-slate-500">
                              {game.awayTeamAbbreviation}
                            </p>
                          </div>

                          <p
                            className={`text-3xl font-black ${
                              awayWon ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {game.awayScore}
                          </p>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4">
                          <div>
                            <p
                              className={`text-lg font-bold ${
                                homeWon ? "text-white" : "text-slate-300"
                              }`}
                            >
                              {game.homeTeamName}
                            </p>
                            <p className="text-sm text-slate-500">
                              {game.homeTeamAbbreviation}
                            </p>
                          </div>

                          <p
                            className={`text-3xl font-black ${
                              homeWon ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {game.homeScore}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section>
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Upcoming Games</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Scheduled matchups without live tracking.
                  </p>
                </div>

                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-300">
                  Scheduled
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {upcomingGames.map((game) => (
                  <article
                    key={game.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <p className="text-sm text-slate-400">
                      {formatGameDate(game.gameDate)}
                    </p>

                    <div className="mt-4 rounded-xl bg-slate-900 p-4">
                      <p className="text-sm font-semibold text-slate-400">
                        Away
                      </p>
                      <p className="text-lg font-bold">
                        {game.awayTeamName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {game.awayTeamAbbreviation}
                      </p>
                    </div>

                    <div className="my-3 text-center text-sm font-bold uppercase tracking-[0.3em] text-slate-500">
                      at
                    </div>

                    <div className="rounded-xl bg-slate-900 p-4">
                      <p className="text-sm font-semibold text-slate-400">
                        Home
                      </p>
                      <p className="text-lg font-bold">
                        {game.homeTeamName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {game.homeTeamAbbreviation}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
              <h3 className="text-xl font-bold text-blue-200">
                Why no live scores yet?
              </h3>
              <p className="mt-3 text-sm leading-6 text-blue-100/80">
                GamePulse is starting with stable schedule, results, team, and
                analytics data first. Live sports features can be added later as
                a premium layer so the MVP stays realistic and affordable.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}