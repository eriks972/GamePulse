"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Game, Team, TeamStats } from "@/lib/api";
import SeasonSelector from "../SeasonSelector";

type AnalyticsClientProps = {
  seasons: string[];
  selectedSeason: string;
  teams: Team[];
  games: Game[];
  teamStats: TeamStats[];
};

type AnalyticsTab =
  | "overview"
  | "leaderboards"
  | "offense"
  | "defense"
  | "shooting"
  | "ball-control";

const tabs: { id: AnalyticsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "leaderboards", label: "Leaderboards" },
  { id: "offense", label: "Offense" },
  { id: "defense", label: "Defense" },
  { id: "shooting", label: "Shooting" },
  { id: "ball-control", label: "Ball Control" },
];

type LeaderboardMetric = {
  key: keyof TeamStats;
  title: string;
  description: string;
  label: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
  category: AnalyticsTab;
};

const leaderboardMetrics: LeaderboardMetric[] = [
  {
    key: "pointsPerGame",
    title: "Scoring Leaders",
    description: "Teams ranked by points scored per game.",
    label: "PPG",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
    category: "offense",
  },
  {
    key: "assistsPerGame",
    title: "Assist Leaders",
    description: "Teams ranked by assists per game.",
    label: "APG",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
    category: "offense",
  },
  {
    key: "scoringMargin",
    title: "Best Scoring Margin",
    description: "Teams with the strongest average point differential.",
    label: "Margin",
    higherIsBetter: true,
    format: (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`,
    category: "overview",
  },
  {
    key: "opponentPointsPerGame",
    title: "Best Defensive Teams",
    description: "Teams allowing the fewest opponent points per game.",
    label: "OPP PPG",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
    category: "defense",
  },
  {
    key: "reboundsPerGame",
    title: "Rebounding Leaders",
    description: "Teams ranked by total rebounds per game.",
    label: "RPG",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
    category: "defense",
  },
  {
    key: "stealsPerGame",
    title: "Steals Leaders",
    description: "Teams ranked by steals per game.",
    label: "SPG",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
    category: "defense",
  },
  {
    key: "blocksPerGame",
    title: "Blocks Leaders",
    description: "Teams ranked by blocks per game.",
    label: "BPG",
    higherIsBetter: true,
    format: (value) => value.toFixed(1),
    category: "defense",
  },
  {
    key: "fieldGoalPercentage",
    title: "Best FG%",
    description: "Teams ranked by field goal percentage.",
    label: "FG%",
    higherIsBetter: true,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    category: "shooting",
  },
  {
    key: "threePointPercentage",
    title: "Best 3PT%",
    description: "Teams ranked by three-point percentage.",
    label: "3PT%",
    higherIsBetter: true,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    category: "shooting",
  },
  {
    key: "freeThrowPercentage",
    title: "Best FT%",
    description: "Teams ranked by free throw percentage.",
    label: "FT%",
    higherIsBetter: true,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    category: "shooting",
  },
  {
    key: "turnoversPerGame",
    title: "Best Ball Control",
    description: "Teams with the fewest turnovers per game.",
    label: "TOV",
    higherIsBetter: false,
    format: (value) => value.toFixed(1),
    category: "ball-control",
  },
];

function buildLeaderboards(teamStats: TeamStats[], category?: AnalyticsTab) {
  return leaderboardMetrics
    .filter((metric) => {
      if (!category || category === "leaderboards") return true;
      if (category === "overview") {
        return ["pointsPerGame", "opponentPointsPerGame", "scoringMargin"].includes(
          metric.key as string,
        );
      }

      return metric.category === category;
    })
    .map((metric) => {
      const sortedTeams = [...teamStats].sort((a, b) => {
        const aValue = Number(a[metric.key]) || 0;
        const bValue = Number(b[metric.key]) || 0;

        return metric.higherIsBetter ? bValue - aValue : aValue - bValue;
      });

      return {
        ...metric,
        teams: sortedTeams.slice(0, 5),
      };
    });
}

export default function AnalyticsClient({
  seasons,
  selectedSeason,
  teams,
  games,
  teamStats,
}: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");

  const enrichedTeams = useMemo(() => {
    return teams
      .map((team) => {
        const totalGames = team.wins + team.losses;
        const winPercentage = totalGames > 0 ? team.wins / totalGames : 0;
        const strengthScore = Math.round(winPercentage * 100);

        return {
          ...team,
          totalGames,
          winPercentage,
          strengthScore,
        };
      })
      .sort((a, b) => b.strengthScore - a.strengthScore);
  }, [teams]);

  const bestTeam = enrichedTeams[0];

  const easternTeams = teams.filter((team) => team.conference === "Eastern");
  const westernTeams = teams.filter((team) => team.conference === "Western");

  const teamsAbove600 = enrichedTeams.filter(
    (team) => team.winPercentage >= 0.6,
  );

  const teamsBelow400 = enrichedTeams.filter(
    (team) => team.winPercentage < 0.4,
  );

  const averageWinPercentage =
    enrichedTeams.length > 0
      ? enrichedTeams.reduce((sum, team) => sum + team.winPercentage, 0) /
        enrichedTeams.length
      : 0;

  const visibleLeaderboards = buildLeaderboards(
    teamStats,
    activeTab === "leaderboards" ? "leaderboards" : activeTab,
  );

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
              Explore real season-based NBA summaries using processed standings,
              historical game data, and team stat averages.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/leagues/nba/teams?season=${selectedSeason}`}
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Teams
            </Link>

            <Link
              href={`/leagues/nba/compare?season=${selectedSeason}`}
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Compare
            </Link>

            <Link
              href={`/leagues/nba/standings?season=${selectedSeason}`}
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Standings
            </Link>
          </div>
        </div>

        <SeasonSelector seasons={seasons} selectedSeason={selectedSeason} />

        <div className="mt-8 flex flex-wrap gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-5 py-2 text-sm font-bold transition ${
                  isActive
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-700 text-slate-300 hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Top Team</p>
                <h2 className="mt-3 text-2xl font-bold">{bestTeam?.name}</h2>
                <p className="mt-2 text-blue-300">
                  {bestTeam?.wins}-{bestTeam?.losses}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Best Strength Score</p>
                <h2 className="mt-3 text-4xl font-black text-blue-300">
                  {bestTeam?.strengthScore}
                </h2>
                <p className="mt-2 text-slate-400">Record-based metric</p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Games Loaded</p>
                <h2 className="mt-3 text-4xl font-black">{games.length}</h2>
                <p className="mt-2 text-slate-400">{selectedSeason} season</p>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Average Win %</p>
                <h2 className="mt-3 text-4xl font-black">
                  {averageWinPercentage.toFixed(3)}
                </h2>
                <p className="mt-2 text-slate-400">League average</p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Teams Above .600</p>
                <h2 className="mt-3 text-4xl font-black text-blue-300">
                  {teamsAbove600.length}
                </h2>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Teams Below .400</p>
                <h2 className="mt-3 text-4xl font-black text-blue-300">
                  {teamsBelow400.length}
                </h2>
              </div>
            </div>
          </>
        )}

        <LeaderboardSection
          leaderboards={visibleLeaderboards}
          selectedSeason={selectedSeason}
          title={
            activeTab === "overview"
              ? "Featured Leaderboards"
              : activeTab === "leaderboards"
                ? "Team Stat Leaderboards"
                : `${tabs.find((tab) => tab.id === activeTab)?.label} Leaderboards`
          }
        />
      </section>
    </main>
  );
}

type LeaderboardSectionProps = {
  leaderboards: ReturnType<typeof buildLeaderboards>;
  selectedSeason: string;
  title: string;
};

function LeaderboardSection({
  leaderboards,
  selectedSeason,
  title,
}: LeaderboardSectionProps) {
  return (
    <section className="mt-10">
      <div>
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 max-w-3xl text-slate-400">
          Explore team leaders for the selected season.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {leaderboards.map((leaderboard) => (
          <div
            key={leaderboard.key}
            className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
          >
            <div>
              <h3 className="text-xl font-bold leading-snug">
                {leaderboard.title}
              </h3>

              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                {leaderboard.description}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {leaderboard.teams.map((team, index) => {
                const value = Number(team[leaderboard.key]) || 0;

                return (
                  <Link
                    href={`/leagues/nba/teams/${team.externalTeamId}?season=${selectedSeason}`}
                    key={`${leaderboard.key}-${team.externalTeamId}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-blue-500"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-black text-blue-300">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">
                        {team.name}
                      </p>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {team.abbreviation} · {team.conference}
                      </p>
                    </div>

                    <div className="min-w-19 text-right">
                      <p className="text-xl font-black text-blue-300">
                        {leaderboard.format(value)}
                      </p>

                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {leaderboard.label}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}