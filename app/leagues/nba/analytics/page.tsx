import {
  getNbaGames,
  getNbaSeasons,
  getNbaStandings,
  getNbaTeamStats,
} from "@/lib/api";
import AnalyticsClient from "./analyticsClient";

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

  return (
    <AnalyticsClient
      seasons={seasons}
      selectedSeason={selectedSeason}
      teams={teams}
      games={games}
      teamStats={teamStats}
    />
  );
}