"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Team, TeamStats } from "@/lib/api";

type CompareTeamsClientProps = {
  teams: Team[];
  seasons: string[];
  selectedSeason: string;
  teamStats: TeamStats[] | null;
};

function getWinPercentage(team: Team) {
  const totalGames = team.wins + team.losses;
  return totalGames > 0 ? team.wins / totalGames : 0;
}

function getStrengthScore(team: Team) {
  return Math.round(getWinPercentage(team) * 100);
}

function getGamesPlayed(team: Team) {
  return team.wins + team.losses;
}

export default function CompareTeamsClient({ teams, seasons, selectedSeason, teamStats }: CompareTeamsClientProps) {
  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      return getWinPercentage(b) - getWinPercentage(a);
    });
  }, [teams]);

  const [teamAId, setTeamAId] = useState(String(sortedTeams[0]?.id ?? ""));
  const [teamBId, setTeamBId] = useState(String(sortedTeams[1]?.id ?? ""));

  const teamA =
    teams.find((team) => String(team.id) === teamAId) || sortedTeams[0];

  const teamB =
    teams.find((team) => String(team.id) === teamBId) ||
    sortedTeams.find((team) => team.id !== teamA.id) ||
    sortedTeams[0];

  const teamAStats = teamStats ? teamStats.find((stats) => stats.id === teamA.id) : null;
  const teamBStats = teamStats ? teamStats.find((stats) => stats.id === teamB.id) : null;

  const teamALeagueRank =
    sortedTeams.findIndex((team) => team.id === teamA.id) + 1;

  const teamBLeagueRank =
    sortedTeams.findIndex((team) => team.id === teamB.id) + 1;

  const conferenceRankings = useMemo(() => {
    const grouped = new Map<string, Team[]>();

    teams.forEach((team) => {
      const current = grouped.get(team.conference) || [];
      grouped.set(team.conference, [...current, team]);
    });

    const ranks = new Map<number, number>();

    grouped.forEach((conferenceTeams) => {
      [...conferenceTeams]
        .sort((a, b) => getWinPercentage(b) - getWinPercentage(a))
        .forEach((team, index) => {
          ranks.set(team.id, index + 1);
        });
    });

    return ranks;
  }, [teams]);

  const teamAConferenceRank = conferenceRankings.get(teamA.id) || 0;
  const teamBConferenceRank = conferenceRankings.get(teamB.id) || 0;

  const teamAWinPct = getWinPercentage(teamA);
  const teamBWinPct = getWinPercentage(teamB);

  const teamAStrengthScore = getStrengthScore(teamA);
  const teamBStrengthScore = getStrengthScore(teamB);

  const sameConference = teamA.conference === teamB.conference;
  const sameDivision = teamA.division === teamB.division;

  const comparisonRows = [
    {
      label: "League Rank",
      teamAValue: `#${teamALeagueRank}`,
      teamBValue: `#${teamBLeagueRank}`,
      winner:
        teamALeagueRank < teamBLeagueRank
          ? teamA.id
          : teamBLeagueRank < teamALeagueRank
            ? teamB.id
            : null,
    },
    {
      label: "Conference Rank",
      teamAValue: `#${teamAConferenceRank}`,
      teamBValue: `#${teamBConferenceRank}`,
      winner:
        teamAConferenceRank < teamBConferenceRank
          ? teamA.id
          : teamBConferenceRank < teamAConferenceRank
            ? teamB.id
            : null,
    },
    {
      label: "Wins",
      teamAValue: teamA.wins,
      teamBValue: teamB.wins,
      winner:
        teamA.wins > teamB.wins
          ? teamA.id
          : teamB.wins > teamA.wins
            ? teamB.id
            : null,
    },
    {
      label: "Losses",
      teamAValue: teamA.losses,
      teamBValue: teamB.losses,
      winner:
        teamA.losses < teamB.losses
          ? teamA.id
          : teamB.losses < teamA.losses
            ? teamB.id
            : null,
    },
    {
      label: "Games Played",
      teamAValue: getGamesPlayed(teamA),
      teamBValue: getGamesPlayed(teamB),
      winner: null,
    },
    {
      label: "Win Percentage",
      teamAValue: teamAWinPct.toFixed(3),
      teamBValue: teamBWinPct.toFixed(3),
      winner:
        teamAWinPct > teamBWinPct
          ? teamA.id
          : teamBWinPct > teamAWinPct
            ? teamB.id
            : null,
    },
    {
      label: "Strength Score",
      teamAValue: teamAStrengthScore,
      teamBValue: teamBStrengthScore,
      winner:
        teamAStrengthScore > teamBStrengthScore
          ? teamA.id
          : teamBStrengthScore > teamAStrengthScore
            ? teamB.id
            : null,
    },
    {
      label: "Conference",
      teamAValue: teamA.conference,
      teamBValue: teamB.conference,
      winner: null,
    },
    {
      label: "Division",
      teamAValue: teamA.division,
      teamBValue: teamB.division,
      winner: null,
    },
    {
      label: "Points Per Game",
      teamAValue: teamAStats ? teamAStats.pointsPerGame.toFixed(1) : "N/A",
      teamBValue: teamBStats ? teamBStats.pointsPerGame.toFixed(1) : "N/A",
      winner: teamAStats && teamBStats ? (teamAStats.pointsPerGame > teamBStats.pointsPerGame ? teamA.id : teamB.id) : null
    },
    {
      label: "Opponent Points Per Game",
      teamAValue: teamAStats ? teamAStats.opponentPointsPerGame.toFixed(1) : "N/A",
      teamBValue: teamBStats ? teamBStats.opponentPointsPerGame.toFixed(1) : "N/A",
      winner: teamAStats && teamBStats ? (teamAStats.opponentPointsPerGame < teamBStats.opponentPointsPerGame ? teamA.id : teamB.id) : null
    },
    {
      label: "Rebounds Per Game",
      teamAValue: teamAStats ? teamAStats.reboundsPerGame.toFixed(1) : "N/A",
      teamBValue: teamBStats ? teamBStats.reboundsPerGame.toFixed(1) : "N/A",
      winner: teamAStats && teamBStats ? (teamAStats.reboundsPerGame > teamBStats.reboundsPerGame ? teamA.id : teamB.id) : null
    },
    {
      label: "Assists Per Game",
      teamAValue: teamAStats ? teamAStats.assistsPerGame.toFixed(1) : "N/A",
      teamBValue: teamBStats ? teamBStats.assistsPerGame.toFixed(1) : "N/A",
      winner: teamAStats && teamBStats ? (teamAStats.assistsPerGame > teamBStats.assistsPerGame ? teamA.id : teamB.id) : null
    }
  ];

  const recordGap = Math.abs(teamA.wins - teamB.wins);

  const strongerTeam =
    teamAWinPct > teamBWinPct
      ? teamA
      : teamBWinPct > teamAWinPct
        ? teamB
        : null;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA
            </p>

            <h1 className="mt-3 text-4xl font-bold">Compare Teams</h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Compare NBA teams side by side using record-based rankings,
              conference context, division context, and early GamePulse metrics.
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

            <Link
              href="/leagues/nba/analytics"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Analytics
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
      window.location.href = `/leagues/nba/compare?season=${event.target.value}`;
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

        <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="teamA"
                className="text-sm font-semibold text-slate-300"
              >
                Team A
              </label>

              <select
                id="teamA"
                value={teamAId}
                onChange={(event) => setTeamAId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              >
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    #{sortedTeams.findIndex((item) => item.id === team.id) + 1}{" "}
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="teamB"
                className="text-sm font-semibold text-slate-300"
              >
                Team B
              </label>

              <select
                id="teamB"
                value={teamBId}
                onChange={(event) => setTeamBId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              >
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    #{sortedTeams.findIndex((item) => item.id === team.id) + 1}{" "}
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {teamA.id === teamB.id && (
            <div className="mt-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              You selected the same team twice. Choose a different Team B for a
              more useful comparison.
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[teamA, teamB].map((team) => {
            const winPct = getWinPercentage(team);
            const leagueRank =
              sortedTeams.findIndex((item) => item.id === team.id) + 1;
            const conferenceRank = conferenceRankings.get(team.id) || 0;

            return (
              <Link
                href={`/leagues/nba/teams/${team.id}`}
                key={team.id}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl transition hover:border-blue-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
                      {team.conference}
                    </p>

                    <h2 className="mt-3 text-3xl font-bold">{team.name}</h2>

                    <p className="mt-2 text-slate-400">
                      {team.city} · {team.division}
                    </p>
                  </div>

                  <span className="rounded-2xl bg-blue-500/10 px-4 py-3 text-xl font-black text-blue-200">
                    {team.abbreviation}
                  </span>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-800 p-5">
                    <p className="text-sm text-slate-400">Record</p>
                    <p className="mt-2 text-3xl font-bold">
                      {team.wins}-{team.losses}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-5">
                    <p className="text-sm text-slate-400">Win %</p>
                    <p className="mt-2 text-3xl font-bold">
                      {winPct.toFixed(3)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-5">
                    <p className="text-sm text-slate-400">League Rank</p>
                    <p className="mt-2 text-3xl font-bold">#{leagueRank}</p>
                  </div>

                  <div className="rounded-2xl bg-slate-800 p-5">
                    <p className="text-sm text-slate-400">Conf. Rank</p>
                    <p className="mt-2 text-3xl font-bold">
                      #{conferenceRank}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <div>Metric</div>
            <div>{teamA.abbreviation}</div>
            <div>{teamB.abbreviation}</div>
          </div>

          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-3 border-b border-slate-800 px-5 py-5 last:border-b-0"
            >
              <div className="font-semibold text-slate-300">{row.label}</div>

              <div
                className={`font-bold ${
                  row.winner === teamA.id ? "text-blue-300" : "text-white"
                }`}
              >
                {row.teamAValue}
              </div>

              <div
                className={`font-bold ${
                  row.winner === teamB.id ? "text-blue-300" : "text-white"
                }`}
              >
                {row.teamBValue}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h2 className="text-xl font-bold text-blue-200">
              Record Advantage
            </h2>

            <p className="mt-3 text-sm leading-6 text-blue-100/80">
              {strongerTeam ? (
                <>
                  <span className="font-bold text-blue-100">
                    {strongerTeam.name}
                  </span>{" "}
                  currently has the stronger overall record by win percentage.
                </>
              ) : (
                <>Both teams currently have the same win percentage.</>
              )}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Win Gap</h2>

            <p className="mt-3 text-4xl font-black text-blue-300">
              {recordGap}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Difference in total wins.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">Matchup Context</h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {sameDivision
                ? "These teams are in the same division, making this a direct divisional comparison."
                : sameConference
                  ? "These teams are in the same conference but different divisions."
                  : "These teams are in different conferences, making this a cross-conference comparison."}
            </p>
          </div>
        </section>

        <div className="mt-8 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
          <h2 className="text-xl font-bold text-blue-200">
            Future Comparison Metrics
          </h2>

          <p className="mt-3 text-sm leading-6 text-blue-100/80">
            This comparison view is ready for deeper sports analytics. Later,
            we can add offensive rating, defensive rating, net rating, player
            dependency score, recent form, home/away splits, and head-to-head
            results.
          </p>
        </div>
      </section>
    </main>
  );
}