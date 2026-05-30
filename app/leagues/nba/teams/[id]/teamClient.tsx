"use client";

import Link from "next/link";
import type { Game, Team } from "@/lib/api";
import { getGameId, getTeamId } from "@/lib/api";

type TeamClientProps = {
  team: Team;
  seasons: string[];
  selectedSeason: string;
  games: Game[];
};

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function TeamClient({
  team,
  seasons,
  selectedSeason,
  games,
}: TeamClientProps) {
  const teamId = getTeamId(team);
  const totalGames = team.wins + team.losses;
  const winPercentage =
    totalGames > 0 ? (team.wins / totalGames).toFixed(3) : "0.000";

  const recentGames = games.slice(0, 8);

  const wins = games.filter((game) => {
    const isHomeTeam = game.homeExternalTeamId === teamId;
    const isAwayTeam = game.awayExternalTeamId === teamId;

    if (isHomeTeam) return game.homeScore > game.awayScore;
    if (isAwayTeam) return game.awayScore > game.homeScore;

    return false;
  });

  const losses = games.filter((game) => {
    const isHomeTeam = game.homeExternalTeamId === teamId;
    const isAwayTeam = game.awayExternalTeamId === teamId;

    if (isHomeTeam) return game.homeScore < game.awayScore;
    if (isAwayTeam) return game.awayScore < game.homeScore;

    return false;
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href={`/leagues/nba/teams?season=${selectedSeason}`}
              className="text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              ← Back to NBA Teams
            </Link>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              {team.conference} Conference
            </p>

            <h1 className="mt-3 text-4xl font-bold">{team.name}</h1>

            <p className="mt-3 text-lg text-slate-300">
              {team.city} · {team.division} Division · {selectedSeason} Season
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/leagues/nba/standings?season=${selectedSeason}`}
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Standings
            </Link>

            <Link
              href={`/leagues/nba/compare?season=${selectedSeason}`}
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Compare
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <label
            htmlFor="season"
            className="mb-2 block text-sm font-semibold text-slate-300"
          >
            Season
          </label>

          <select
            id="season"
            value={selectedSeason}
            onChange={(event) => {
              window.location.href = `/leagues/nba/teams/${teamId}?season=${event.target.value}`;
            }}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
          >
            {(seasons ?? []).map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
                Team Profile
              </p>

              <h2 className="mt-3 text-3xl font-bold">{team.name}</h2>

              <p className="mt-3 text-slate-300">
                {team.city} · {team.conference} · {team.division}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-500/10 px-6 py-4 text-center">
              <p className="text-sm text-blue-300">Abbreviation</p>
              <p className="text-3xl font-black text-blue-200">
                {team.abbreviation}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Record</p>
              <p className="mt-2 text-3xl font-bold">
                {team.wins}-{team.losses}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Win Percentage</p>
              <p className="mt-2 text-3xl font-bold">{winPercentage}</p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Games Loaded</p>
              <p className="mt-2 text-3xl font-bold">{games.length}</p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Verified Split</p>
              <p className="mt-2 text-3xl font-bold">
                {wins.length}-{losses.length}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Recent Games</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest games from the selected season.
              </p>
            </div>

            <Link
              href={`/leagues/nba/schedule?season=${selectedSeason}`}
              className="text-sm font-bold text-blue-300 hover:text-blue-200"
            >
              View full schedule →
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {recentGames.map((game) => {
              const gameId = getGameId(game);
              const isHomeTeam = game.homeExternalTeamId === teamId;
              const teamScore = isHomeTeam ? game.homeScore : game.awayScore;
              const opponentScore = isHomeTeam
                ? game.awayScore
                : game.homeScore;
              const opponentName = isHomeTeam
                ? game.awayTeamName
                : game.homeTeamName;
              const opponentAbbreviation = isHomeTeam
                ? game.awayTeamAbbreviation
                : game.homeTeamAbbreviation;
              const result = teamScore > opponentScore ? "W" : "L";

              return (
                <article
                  key={gameId}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">
                        {formatGameDate(game.gameDate)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        vs {opponentName} ({opponentAbbreviation})
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        result === "W"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-red-500/10 text-red-300"
                      }`}
                    >
                      {result}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-900 p-4">
                    <div>
                      <p className="text-sm text-slate-400">Final Score</p>
                      <p className="mt-1 text-xl font-bold">
                        {team.abbreviation} {teamScore} ·{" "}
                        {opponentAbbreviation} {opponentScore}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-slate-400">
                      {game.status}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {recentGames.length === 0 && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center">
              <h3 className="text-xl font-bold">No games found</h3>
              <p className="mt-2 text-slate-400">
                No games were found for this team in the selected season.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}