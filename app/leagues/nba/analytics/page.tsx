import Link from "next/link";
import {
  getTeamId,
  getNbaGames,
  getNbaSeasons,
  getNbaStandings,
  getNbaTeamStats
} from "@/lib/api";
import type { TeamStats } from "@/lib/api";
import SeasonSelector from "../SeasonSelector";

type NbaAnalyticsPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function NbaAnalyticsPage({
  searchParams,
}: NbaAnalyticsPageProps) {
  const params = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = params?.season || seasons[0];

  const teams = await getNbaStandings(selectedSeason);
  const games = await getNbaGames(selectedSeason);
  const teamStats = await getNbaTeamStats(selectedSeason);

  

  type LeaderboardMetric = {
    key: keyof TeamStats;
    title: string;
    description: string;
    label: string;
    higherIsBetter: boolean;
    format: (value: number) => string;
  };

  const leaderboardMetrics: LeaderboardMetric[] = [
    {
      key: "pointsPerGame",
      title: "Scoring Leaders",
      description: "Teams ranked by points scored per game.",
      label: "PPG",
      higherIsBetter: true,
      format: (value) => value.toFixed(1),
    },
    {
      key: "opponentPointsPerGame",
      title: "Best Defensive Teams",
      description: "Teams allowing the fewest opponent points per game.",
      label: "OPP PPG",
      higherIsBetter: false,
      format: (value) => value.toFixed(1),
    },
    {
      key: "scoringMargin",
      title: "Best Scoring Margin",
      description: "Teams with the strongest average point differential.",
      label: "Margin",
      higherIsBetter: true,
      format: (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`,
    },
    {
      key: "reboundsPerGame",
      title: "Rebounding Leaders",
      description: "Teams ranked by total rebounds per game.",
      label: "RPG",
      higherIsBetter: true,
      format: (value) => value.toFixed(1),
    },
    {
      key: "assistsPerGame",
      title: "Assist Leaders",
      description: "Teams ranked by assists per game.",
      label: "APG",
      higherIsBetter: true,
      format: (value) => value.toFixed(1),
    },
    {
      key: "turnoversPerGame",
      title: "Best Ball Control",
      description: "Teams with the fewest turnovers per game.",
      label: "TOV",
      higherIsBetter: false,
      format: (value) => value.toFixed(1),
    },
    {
      key: "fieldGoalPercentage",
      title: "Best FG%",
      description: "Teams ranked by field goal percentage.",
      label: "FG%",
      higherIsBetter: true,
      format: (value) => `${(value * 100).toFixed(1)}%`,
    },
    {
      key: "threePointPercentage",
      title: "Best 3PT%",
      description: "Teams ranked by three-point percentage.",
      label: "3PT%",
      higherIsBetter: true,
      format: (value) => `${(value * 100).toFixed(1)}%`,
    },
    {
      key: "freeThrowPercentage",
      title: "Best FT%",
      description: "Teams ranked by free throw percentage.",
      label: "FT%",
      higherIsBetter: true,
      format: (value) => `${(value * 100).toFixed(1)}%`,
    },
  ];

  const leaderboards = leaderboardMetrics.map((metric) => {
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

  const enrichedTeams = teams
    .map((team) => {
      const totalGames = team.wins + team.losses;
      const winPercentage = totalGames > 0 ? team.wins / totalGames : 0;

      // Record-based MVP metric until we import richer team/player stat datasets.
      const strengthScore = Math.round(winPercentage * 100);

      return {
        ...team,
        totalGames,
        winPercentage,
        strengthScore,
      };
    })
    .sort((a, b) => {
      if (b.strengthScore !== a.strengthScore) {
        return b.strengthScore - a.strengthScore;
      }

      return b.wins - a.wins;
    });

  const bestTeam = enrichedTeams[0];
  const mostLosses = [...enrichedTeams].sort((a, b) => b.losses - a.losses)[0];

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
              Explore real season-based NBA summaries using processed standings
              and historical game data from the GamePulse backend.
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

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div>
              <h2 className="text-2xl font-bold">Strength Rankings</h2>
              <p className="mt-2 text-sm text-slate-400">
                Current score is based on season win percentage. This will be
                replaced with a deeper model after importing team and player
                statistics.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {enrichedTeams.slice(0, 10).map((team, index) => {
                const teamId = getTeamId(team);

                return (
                  <Link
                    href={`/leagues/nba/teams/${teamId}?season=${selectedSeason}`}
                    key={teamId}
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
                );
              })}
            </div>

            
          </section>

          

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-2xl font-bold">Season Insight</h2>
              <p className="mt-3 text-slate-300">
                In the{" "}
                <span className="font-bold text-blue-300">
                  {selectedSeason}
                </span>{" "}
                season,{" "}
                <span className="font-bold text-blue-300">
                  {bestTeam?.name}
                </span>{" "}
                led the dataset by record-based strength score.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-2xl font-bold">Watch Area</h2>
              <p className="mt-3 text-slate-300">
                <span className="font-bold text-blue-300">
                  {mostLosses?.name}
                </span>{" "}
                had the most losses in the selected season. Later, this card can
                show struggling teams, injury impact, schedule difficulty, or
                recent form trends.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
              <h2 className="text-xl font-bold text-blue-200">
                Future Analytics Layer
              </h2>
              <p className="mt-3 text-sm leading-6 text-blue-100/80">
                This page is now connected to real season data. Next, we can add
                team game logs, player profiles, box scores, player dependency
                score, offensive/defensive metrics, and roster balance.
              </p>
            </div>
          </section>

          <section className="mt-10">
            <div>
                <h2 className="text-3xl font-bold">Team Stat Leaderboards</h2>
                <p className="mt-2 max-w-3xl text-slate-400">
                  Explore the top teams across scoring, defense, rebounding, passing,
                  shooting efficiency, and ball control for the selected season.
                </p>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
                {leaderboards.map((leaderboard) => (
                  <div
                    key={leaderboard.key}
                    className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
                  >
                    <div>
                      <h3 className="text-xl font-bold">{leaderboard.title}</h3>
                      <p className="mt-2 min-h-10 text-sm leading-6 text-slate-400">
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
                            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-blue-500"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-sm font-black text-blue-300">
                                {index + 1}
                              </div>

                              <div>
                                <p className="font-bold">{team.name}</p>
                                <p className="text-sm text-slate-500">
                                  {team.abbreviation} · {team.conference}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
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
          </section>`
        </div>
      </section>
    </main>
  );
}