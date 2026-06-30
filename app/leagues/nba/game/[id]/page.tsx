import Link from "next/link";
import { getGameId, getNbaGameById, getNbaLineScoreByGameId } from "@/lib/api";

type GameDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { id } = await params;

  const game = await getNbaGameById(id);
  const lineScores = await getNbaLineScoreByGameId(id);

  const homeLineScore = lineScores.find((score) => score.isHome);
  const awayLineScore = lineScores.find((score) => !score.isHome);
  const gameId = getGameId(game);
  // const lineScore = await getNbaLineScoreByGameId(gameId);

  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;

  const awayTableName =
  awayLineScore?.teamAbbreviation ||
  awayLineScore?.teamName ||
  game.awayTeamAbbreviation ||
  game.awayTeamName ||
  "Away";

const homeTableName =
  homeLineScore?.teamAbbreviation ||
  homeLineScore?.teamName ||
  game.homeTeamAbbreviation ||
  game.homeTeamName ||
  "Home";

  const quarters = [
  {
    label: "Q1",
    away: awayLineScore?.q1 ?? 0,
    home: homeLineScore?.q1 ?? 0,
  },
  {
    label: "Q2",
    away: awayLineScore?.q2 ?? 0,
    home: homeLineScore?.q2 ?? 0,
  },
  {
    label: "Q3",
    away: awayLineScore?.q3 ?? 0,
    home: homeLineScore?.q3 ?? 0,
  },
  {
    label: "Q4",
    away: awayLineScore?.q4 ?? 0,
    home: homeLineScore?.q4 ?? 0,
  },
];

const hasOvertime =
  (awayLineScore?.ot1 ?? 0) > 0 ||
  (homeLineScore?.ot1 ?? 0) > 0 ||
  (awayLineScore?.ot2 ?? 0) > 0 ||
  (homeLineScore?.ot2 ?? 0) > 0 ||
  (awayLineScore?.otAll ?? 0) > 0 ||
  (homeLineScore?.otAll ?? 0) > 0;

if (hasOvertime) {
  quarters.push({
    label: "OT",
    away:
      (awayLineScore?.ot1 ?? 0) +
      (awayLineScore?.ot2 ?? 0) +
      (awayLineScore?.otAll ?? 0),
    home:
      (homeLineScore?.ot1 ?? 0) +
      (homeLineScore?.ot2 ?? 0) +
      (homeLineScore?.otAll ?? 0),
  });
}

  const allRows = [...quarters, ...hasOvertime ? [] : []];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <Link
          href={`/leagues/nba/schedule?season=${game.season}`}
          className="text-sm font-semibold text-blue-400 hover:text-blue-300"
        >
          ← Back to Schedule
        </Link>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              GamePulse NBA · {game.season}
            </p>

            <h1 className="mt-3 text-4xl font-bold">Game Detail</h1>

            <p className="mt-3 text-lg text-slate-300">
              {formatGameDate(game.gameDate)}
            </p>
          </div>

          <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300">
            {game.status}
          </span>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <Link
              href={`/leagues/nba/teams/${game.awayExternalTeamId}?season=${game.season}`}
              className="rounded-2xl bg-slate-950 p-6 transition hover:border-blue-500"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                Away
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                {game.awayTeamName}
              </h2>
              <p className="mt-2 text-slate-400">
                {game.awayTeamAbbreviation}
              </p>
              <p
                className={`mt-6 text-5xl font-black ${
                  awayWon ? "text-white" : "text-slate-500"
                }`}
              >
                {game.awayScore}
              </p>
            </Link>

            <div className="text-center text-sm font-bold uppercase tracking-[0.3em] text-slate-500">
              at
            </div>

            <Link
              href={`/leagues/nba/teams/${game.homeExternalTeamId}?season=${game.season}`}
              className="rounded-2xl bg-slate-950 p-6 transition hover:border-blue-500"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                Home
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                {game.homeTeamName}
              </h2>
              <p className="mt-2 text-slate-400">
                {game.homeTeamAbbreviation}
              </p>
              <p
                className={`mt-6 text-5xl font-black ${
                  homeWon ? "text-white" : "text-slate-500"
                }`}
              >
                {game.homeScore}
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-2xl font-bold">Quarterly Breakdown</h2>
          <p className="mt-2 text-sm text-slate-400">
            Scoring by period from line score data.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <div className="grid grid-cols-3 bg-slate-950 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <div>Period</div>
              <div>{awayTableName}</div>
              <div>{homeTableName}</div>
            </div>

            {allRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-3 border-t border-slate-800 px-5 py-4"
              >
                <div className="font-bold text-slate-300">{row.label}</div>
                <div className="font-bold">{row.away}</div>
                <div className="font-bold">{row.home}</div>
              </div>
            ))}

            <div className="grid grid-cols-3 border-t border-slate-700 bg-slate-800 px-5 py-4">
              <div className="font-black">Final</div>
              <div className="font-black">{game.awayScore}</div>
              <div className="font-black">{game.homeScore}</div>
            </div>
          </div>

          {!lineScores && (
            <p className="mt-4 text-sm text-yellow-300">
              No line score was found for this game.
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Winner</p>
            <h2 className="mt-3 text-2xl font-bold">
              {homeWon ? game.homeTeamName : game.awayTeamName}
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Margin</p>
            <h2 className="mt-3 text-4xl font-black text-blue-300">
              {Math.abs(game.homeScore - game.awayScore)}
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Game ID</p>
            <h2 className="mt-3 text-xl font-bold">{gameId}</h2>
          </div>
        </section>
      </section>
    </main>
  );
}