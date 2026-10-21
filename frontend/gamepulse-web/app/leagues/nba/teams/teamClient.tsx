"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Team } from "@/lib/api";

type TeamsClientProps = {
  teams: Team[];
  seasons: string[];
  selectedSeason: string;
};

const filters = [
  { label: "All", value: "all" },
  { label: "Eastern", value: "Eastern" },
  { label: "Western", value: "Western" },
  { label: "Atlantic", value: "Atlantic" },
  { label: "Central", value: "Central" },
  { label: "Southeast", value: "Southeast" },
  { label: "Northwest", value: "Northwest" },
  { label: "Pacific", value: "Pacific" },
  { label: "Southwest", value: "Southwest" },
];

export default function TeamsClient({  
  teams,
  seasons,
  selectedSeason,
 }: TeamsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filteredTeams = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return teams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(normalizedSearch) ||
        team.city.toLowerCase().includes(normalizedSearch) ||
        team.abbreviation.toLowerCase().includes(normalizedSearch);

      const matchesFilter =
        selectedFilter === "all" ||
        team.conference === selectedFilter ||
        team.division === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [teams, searchTerm, selectedFilter]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA
            </p>

            <h1 className="mt-3 text-4xl font-bold">NBA Teams</h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Explore NBA teams, records, divisions, and conference information.
              Use search and filters to quickly find teams.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/leagues/nba"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              NBA Home
            </Link>

            <Link
              href="/leagues/nba/standings"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Standings
            </Link>
          </div>
        </div>
        <br></br>
        <div>
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
      window.location.href = `/leagues/nba/teams?season=${event.target.value}`;
    }}
    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
  >
    {seasons.map((season) => (
      <option key={season} value={season}>
        {season}
      </option>
    ))}
  </select>
</div>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <label htmlFor="teamSearch" className="sr-only">
                Search teams
              </label>

              <input
                id="teamSearch"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by team, city, or abbreviation..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const isActive = selectedFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setSelectedFilter(filter.value)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-700 text-slate-300 hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-300"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              Showing{" "}
              <span className="font-bold text-blue-300">
                {filteredTeams.length}
              </span>{" "}
              of <span className="font-bold text-white">{teams.length}</span>{" "}
              teams
            </p>

            {(searchTerm || selectedFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedFilter("all");
                }}
                className="font-semibold text-blue-300 hover:text-blue-200"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        

        {filteredTeams.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map((team) => (
              <Link
                href={`/leagues/nba/teams/${team.id}/?season=${selectedSeason}`}
                key={team.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg transition hover:-translate-y-1 hover:border-blue-500"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{team.name}</h2>

                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-300">
                    {team.abbreviation}
                  </span>
                </div>

                <p className="mt-2 text-slate-400">{team.city}</p>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Conference</p>
                    <p className="font-semibold">{team.conference}</p>
                  </div>

                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Division</p>
                    <p className="font-semibold">{team.division}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <p className="text-lg font-bold">
                    {team.wins}-{team.losses}
                  </p>

                  <p className="text-sm font-semibold text-blue-300">
                    View Team →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h2 className="text-2xl font-bold">No teams found</h2>
            <p className="mt-3 text-slate-400">
              Try changing your search or selecting a different conference or
              division filter.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedFilter("all");
              }}
              className="mt-6 rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </main>
  );
}