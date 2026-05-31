"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Game } from "@/lib/api";

type ScheduleClientProps = {
  games: Game[];
  seasons: string[];
  selectedSeason: string;
};

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function ScheduleClient({
  games,
  seasons,
  selectedSeason,
}: ScheduleClientProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredGames = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return games.filter((game) => {
      if (!normalizedSearch) return true;

      return (
        game.homeTeamName.toLowerCase().includes(normalizedSearch) ||
        game.awayTeamName.toLowerCase().includes(normalizedSearch) ||
        game.homeTeamAbbreviation.toLowerCase().includes(normalizedSearch) ||
        game.awayTeamAbbreviation.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [games, searchTerm]);

  const visibleGames = filteredGames.slice(0, 50);

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
              Explore historical NBA game results by season using processed
              data from the GamePulse backend.
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
              href="/leagues/nba/standings"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Standings
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
              window.location.href = `/leagues/nba/schedule?season=${event.target.value}`;
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

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <label htmlFor="gameSearch" className="sr-only">
                Search games
              </label>

              <input
                id="gameSearch"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by team or abbreviation..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            {(searchTerm || filteredGames.length !== games.length) && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
              >
                Clear Search
              </button>
            )}
          </div>

          <div className="mt-4 text-sm text-slate-400">
            Showing{" "}
            <span className="font-bold text-blue-300">
              {visibleGames.length}
            </span>{" "}
            of{" "}
            <span className="font-bold text-white">{filteredGames.length}</span>{" "}
            matching games for{" "}
            <span className="font-bold text-white">{selectedSeason}</span>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Game Results</h2>
              <p className="mt-1 text-sm text-slate-400">
                Historical completed games from the selected season.
              </p>
            </div>

            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
              Final
            </span>
          </div>

          {visibleGames.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {visibleGames.map((game) => {
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
                    <br></br>
                    <a href={`/leagues/nba/game/${game.id}`} className="text-sm font-semibold text-blue-300">
                      View Details
                    </a>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-10 text-center">
              <h3 className="text-2xl font-bold">No games found</h3>
              <p className="mt-3 text-slate-400">
                Try a different season or search term.
              </p>
            </div>
          )}
        </div>

        {filteredGames.length > visibleGames.length && (
          <div className="mt-6 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="text-xl font-bold text-blue-200">
              Showing first 50 games
            </h3>
            <p className="mt-3 text-sm leading-6 text-blue-100/80">
              This season contains more results than currently displayed. A
              load-more button or pagination can be added next.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}