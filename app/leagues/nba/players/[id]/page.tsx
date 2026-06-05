import Link from "next/link";
import { getNbaPlayerById } from "@/lib/api";

type PlayerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatHeightWeight(height: string, weight: number) {
  if (height && weight > 0) return `${height} · ${weight} lbs`;
  if (height) return height;
  if (weight > 0) return `${weight} lbs`;
  return "Unavailable";
}

function formatCareer(fromYear: number, toYear: number) {
  if (!fromYear && !toYear) return "Unavailable";
  if (fromYear === toYear) return String(fromYear);
  return `${fromYear}-${toYear}`;
}

function formatDraft(draftYear: string, draftRound: string, draftNumber: string) {
  if (!draftYear || draftYear === "Undrafted") return "Undrafted";

  const round = draftRound ? `Round ${draftRound}` : "Round unavailable";
  const pick = draftNumber ? `Pick ${draftNumber}` : "Pick unavailable";

  return `${draftYear} · ${round} · ${pick}`;
}

export default async function PlayerDetailPage({
  params,
}: PlayerDetailPageProps) {
  const { id } = await params;
  const player = await getNbaPlayerById(id);

  if (!player) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-5xl">
          <Link
            href="/leagues/nba/players"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            Back to NBA Players
          </Link>

          <h1 className="mt-8 text-3xl font-bold">Player not found</h1>
          <p className="mt-3 text-slate-400">
            This player could not be found in the processed NBA player dataset.
          </p>
        </section>
      </main>
    );
  }

  const teamLabel = player.teamName
    ? `${player.teamCity} ${player.teamName}`.trim()
    : "No current team listed";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/leagues/nba/players"
              className="text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              Back to NBA Players
            </Link>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              {player.rosterStatus || "Roster Status Unknown"}
            </p>

            <h1 className="mt-3 text-4xl font-bold">{player.fullName}</h1>

            <p className="mt-3 text-lg text-slate-300">
              {player.position || "Position unavailable"} ·{" "}
              {formatCareer(player.fromYear, player.toYear)}
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
              href="/leagues/nba/analytics"
              className="rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
            >
              Analytics
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
                Player Profile
              </p>

              <h2 className="mt-3 text-3xl font-bold">{player.fullName}</h2>

              <p className="mt-3 max-w-2xl text-slate-300">
                {player.school || "School unavailable"} ·{" "}
                {player.country || "Country unavailable"} ·{" "}
                {player.lastAffiliation || "Affiliation unavailable"}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-500/10 px-6 py-4 text-center">
              <p className="text-sm text-blue-300">Player ID</p>
              <p className="text-3xl font-black text-blue-200">{player.id}</p>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Height / Weight</p>
              <p className="mt-2 text-2xl font-bold">
                {formatHeightWeight(player.height, player.weight)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Experience</p>
              <p className="mt-2 text-2xl font-bold">
                {player.seasonExperience} seasons
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Jersey</p>
              <p className="mt-2 text-2xl font-bold">
                {player.jersey || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">NBA 75</p>
              <p className="mt-2 text-2xl font-bold">
                {player.greatest75 ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-2xl font-bold">Team</h2>

            <div className="mt-6 rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Listed Team</p>
              <p className="mt-2 text-2xl font-bold">{teamLabel}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Abbreviation</p>
                  <p className="mt-1 font-semibold">
                    {player.teamAbbreviation || "N/A"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Team Code</p>
                  <p className="mt-1 font-semibold">
                    {player.teamCode || "N/A"}
                  </p>
                </div>
              </div>

              {player.externalTeamId > 0 && (
                <Link
                  href={`/leagues/nba/teams/${player.externalTeamId}`}
                  className="mt-5 inline-flex rounded-full border border-blue-500/40 px-5 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
                >
                  View Team
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-2xl font-bold">Draft</h2>

            <div className="mt-6 rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Draft Summary</p>
              <p className="mt-2 text-2xl font-bold">
                {formatDraft(
                  player.draftYear,
                  player.draftRound,
                  player.draftNumber,
                )}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Year</p>
                  <p className="mt-1 font-semibold">
                    {player.draftYear || "N/A"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Round</p>
                  <p className="mt-1 font-semibold">
                    {player.draftRound || "N/A"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Pick</p>
                  <p className="mt-1 font-semibold">
                    {player.draftNumber || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Birthdate</p>
              <p className="mt-2 text-xl font-bold">
                {player.birthdate || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">NBA Player</p>
              <p className="mt-2 text-xl font-bold">
                {player.nba ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">Games Played</p>
              <p className="mt-2 text-xl font-bold">
                {player.gamesPlayed ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-800 p-5">
              <p className="text-sm text-slate-400">G League</p>
              <p className="mt-2 text-xl font-bold">
                {player.dLeague ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
