"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Player } from "@/lib/api";

type PlayersClientProps = {
  players: Player[];
};

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

const positionFilters = [
  { label: "All Positions", value: "all" },
  { label: "Guard", value: "Guard" },
  { label: "Forward", value: "Forward" },
  { label: "Center", value: "Center" },
];

const eraFilters = [
  { label: "All Eras", value: "all" },
  { label: "2020s", value: "2020" },
  { label: "2010s", value: "2010" },
  { label: "2000s", value: "2000" },
  { label: "1990s", value: "1990" },
  { label: "Earlier", value: "earlier" },
];

function getPlayerEra(player: Player) {
  if (player.toYear >= 2020) return "2020";
  if (player.toYear >= 2010) return "2010";
  if (player.toYear >= 2000) return "2000";
  if (player.toYear >= 1990) return "1990";
  return "earlier";
}

function formatCareer(player: Player) {
  if (!player.fromYear && !player.toYear) return "Career years unavailable";
  if (player.fromYear === player.toYear) return String(player.fromYear);
  return `${player.fromYear}-${player.toYear}`;
}

export default function PlayersClient({ players }: PlayersClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [selectedEra, setSelectedEra] = useState("all");

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return players.filter((player) => {
      const matchesSearch =
        player.fullName.toLowerCase().includes(normalizedSearch) ||
        player.teamName.toLowerCase().includes(normalizedSearch) ||
        player.teamAbbreviation.toLowerCase().includes(normalizedSearch) ||
        player.school.toLowerCase().includes(normalizedSearch) ||
        player.country.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        selectedStatus === "all" || player.rosterStatus === selectedStatus;

      const matchesPosition =
        selectedPosition === "all" ||
        player.position.toLowerCase().includes(selectedPosition.toLowerCase());

      const matchesEra =
        selectedEra === "all" || getPlayerEra(player) === selectedEra;

      return matchesSearch && matchesStatus && matchesPosition && matchesEra;
    });
  }, [players, searchTerm, selectedStatus, selectedPosition, selectedEra]);

  const activePlayers = players.filter(
    (player) => player.rosterStatus === "Active",
  );
  const greatest75Players = players.filter((player) => player.greatest75);

  function clearFilters() {
    setSearchTerm("");
    setSelectedStatus("all");
    setSelectedPosition("all");
    setSelectedEra("all");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA
            </p>

            <h1 className="mt-3 text-4xl font-bold">NBA Players</h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Search the processed NBA player index by name, team, country,
              school, roster status, position, and career era.
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
              href="/leagues/nba/teams"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Teams
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Players</p>
            <p className="mt-2 text-3xl font-bold">{players.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Active Players</p>
            <p className="mt-2 text-3xl font-bold">{activePlayers.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">NBA 75</p>
            <p className="mt-2 text-3xl font-bold">
              {greatest75Players.length}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_220px]">
            <div>
              <label htmlFor="playerSearch" className="sr-only">
                Search players
              </label>

              <input
                id="playerSearch"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by player, team, school, or country..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
              aria-label="Roster status"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>

            <select
              value={selectedPosition}
              onChange={(event) => setSelectedPosition(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
              aria-label="Position"
            >
              {positionFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>

            <select
              value={selectedEra}
              onChange={(event) => setSelectedEra(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-white outline-none transition focus:border-blue-500"
              aria-label="Career era"
            >
              {eraFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              Showing{" "}
              <span className="font-bold text-blue-300">
                {filteredPlayers.length}
              </span>{" "}
              of <span className="font-bold text-white">{players.length}</span>{" "}
              players
            </p>

            {(searchTerm ||
              selectedStatus !== "all" ||
              selectedPosition !== "all" ||
              selectedEra !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-semibold text-blue-300 hover:text-blue-200"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {filteredPlayers.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlayers.slice(0, 120).map((player) => (
              <Link
                key={player.id}
                href={`/leagues/nba/players/${player.id}`}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg transition hover:-translate-y-1 hover:border-blue-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{player.fullName}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {player.position || "Position unavailable"} ·{" "}
                      {formatCareer(player)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      player.rosterStatus === "Active"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {player.rosterStatus || "Unknown"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Team</p>
                    <p className="font-semibold">
                      {player.teamAbbreviation || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-800 p-3">
                    <p className="text-slate-400">Country</p>
                    <p className="font-semibold">{player.country || "N/A"}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-400">
                    {player.school || "School unavailable"}
                  </p>

                  <p className="shrink-0 text-sm font-semibold text-blue-300">
                    View Player
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
            <h2 className="text-2xl font-bold">No players found</h2>
            <p className="mt-3 text-slate-400">
              Try changing your search, roster status, position, or era filter.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
            >
              Reset Filters
            </button>
          </div>
        )}

        {filteredPlayers.length > 120 && (
          <p className="mt-6 text-center text-sm text-slate-400">
            Showing first 120 matching players. Narrow your search for a shorter
            list.
          </p>
        )}
      </section>
    </main>
  );
}
