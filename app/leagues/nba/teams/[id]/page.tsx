import {
  getNbaGames,
  getNbaSeasons,
  getNbaStandings,
  getTeamId,
} from "@/lib/api";
import TeamClient from "./teamClient";

type TeamDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function TeamDetailPage({
  params,
  searchParams,
}: TeamDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = query?.season || seasons[0];

  const teams = await getNbaStandings(selectedSeason);
  const games = await getNbaGames(selectedSeason);

  const team = teams.find((team) => String(getTeamId(team)) === id);

  if (!team) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">Team not found</h1>
          <p className="mt-3 text-slate-400">
            This team could not be found for the selected season.
          </p>
        </section>
      </main>
    );
  }

  const teamGames = games.filter(
    (game) =>
      game.homeExternalTeamId === getTeamId(team) ||
      game.awayExternalTeamId === getTeamId(team),
  );

  return (
    <TeamClient
      team={team}
      seasons={seasons}
      selectedSeason={selectedSeason}
      games={teamGames}
    />
  );
}