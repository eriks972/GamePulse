import Link from "next/link";
import {
  getGameId,
  getNbaGames,
  getNbaSeasons,
  getNbaStandings,
} from "@/lib/api";
import SeasonSelector from "./SeasonSelector";

type NbaLandingPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function NbaLandingPage({
  searchParams,
}: NbaLandingPageProps) {
  const params = await searchParams;

  let seasons: string[] = [];

  try {
    seasons = await getNbaSeasons();
  } catch (error) {
    console.error("NBA dashboard seasons failed", error);
    seasons = ["2022"];
  }

  const selectedSeason = params?.season || seasons[0] || "2025";

  let teams: Awaited<ReturnType<typeof getNbaStandings>> = [];

  try {
    teams = await getNbaStandings(selectedSeason);
  } catch (error) {
    console.error("NBA dashboard standings failed", error);
    teams = [];
  }

  let games: Awaited<ReturnType<typeof getNbaGames>> = [];

  try {
    games = await getNbaGames(selectedSeason);
  } catch (error) {
    console.error("NBA dashboard games failed", error);
    games = [];
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const winPctA = a.wins / Math.max(a.wins + a.losses, 1);
    const winPctB = b.wins / Math.max(b.wins + b.losses, 1);
    return winPctB - winPctA;
  });

  const topTeam = sortedTeams[0];
  const recentFinals = games.filter((game) => game.status === "Final").slice(0, 4);

  const totalGames = games.length;
  const easternTeams = teams.filter((team) => team.conference === "Eastern");
  const westernTeams = teams.filter((team) => team.conference === "Western");

  const topTeamWinPercentage =
    topTeam && topTeam.wins + topTeam.losses > 0
      ? (topTeam.wins / (topTeam.wins + topTeam.losses)).toFixed(3)
      : "0.000";

  const navCards = [
    {
      title: "Teams",
      description: "Explore NBA teams, conferences, divisions, and records.",
      href: `/leagues/nba/teams?season=${selectedSeason}`,
      label: "View Teams",
    },
    {
      title: "Schedule & Results",
      description: "Browse historical game results from the selected season.",
      href: `/leagues/nba/schedule?season=${selectedSeason}`,
      label: "View Schedule",
    },
    {
      title: "Standings",
      description: "Rank NBA teams by record and win percentage.",
      href: `/leagues/nba/standings?season=${selectedSeason}`,
      label: "View Standings",
    },
    {
      title: "Compare Teams",
      description: "Compare two teams side by side using season records.",
      href: `/leagues/nba/compare?season=${selectedSeason}`,
      label: "Compare Teams",
    },
    {
      title: "Analytics",
      description: "Review early strength scores and future analytics previews.",
      href: `/leagues/nba/analytics?season=${selectedSeason}`,
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
                Explore historical NBA teams, schedules, standings,
                comparisons, and early analytics for the selected season.
              </p>

              <div className="mt-8">

                <SeasonSelector seasons={seasons} selectedSeason={selectedSeason} />

              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/leagues/nba/teams?season=${selectedSeason}`}
                  className="rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
                >
                  Explore Teams
                </Link>

                <Link
                  href={`/leagues/nba/analytics?season=${selectedSeason}`}
                  className="rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10"
                >
                  View Analytics
                </Link>
              </div>
            </div>

            {topTeam && (
              <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
                  Top Team · {selectedSeason}
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
                    <p className="text-sm text-slate-400">Win %</p>
                    <p className="mt-2 text-2xl font-bold">
                      {topTeamWinPercentage}
                    </p>
                  </div>
                </div>
              </div>
            )}
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

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Season</p>
            <h2 className="mt-3 text-4xl font-black text-blue-300">
              {selectedSeason}
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Games Loaded</p>
            <h2 className="mt-3 text-4xl font-black">{totalGames}</h2>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Eastern Teams</p>
            <h2 className="mt-3 text-4xl font-black">
              {easternTeams.length}
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm text-slate-400">Western Teams</p>
            <h2 className="mt-3 text-4xl font-black">
              {westernTeams.length}
            </h2>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Recent Results</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest completed games in the selected historical season.
              </p>
            </div>

            <Link
              href={`/leagues/nba/schedule?season=${selectedSeason}`}
              className="text-sm font-bold text-blue-300 hover:text-blue-200"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {recentFinals.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 lg:col-span-2">
                <p className="font-bold text-white">Recent results unavailable</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Game results could not be loaded right now. The rest of the NBA
                  dashboard is still available.
                </p>
              </div>
            )}
            
            {recentFinals.map((game) => {
              const gameId = getGameId(game);
              const homeWon = game.homeScore > game.awayScore;
              const awayWon = game.awayScore > game.homeScore;

              return (
                <div
                  key={gameId}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      {formatGameDate(game.gameDate)}
                    </p>

                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
                      {game.status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 p-4">
                    <div>
                      <p
                        className={`font-bold ${
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
                      className={`text-2xl font-black ${
                        awayWon ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {game.awayScore}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 p-4">
                    <div>
                      <p
                        className={`font-bold ${
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
                      className={`text-2xl font-black ${
                        homeWon ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {game.homeScore}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}