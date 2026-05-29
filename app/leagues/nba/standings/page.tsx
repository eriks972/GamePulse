import { getNbaSeasons, getNbaStandings } from "@/lib/api";
import StandingsClient from "./standingsClient";

type NbaStandingsPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function NbaStandingsPage({
  searchParams,
}: NbaStandingsPageProps) {
  const params = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = params?.season || seasons[0];

  const teams = await getNbaStandings(selectedSeason);

  return (
    <StandingsClient
      teams={teams}
      seasons={seasons}
      selectedSeason={selectedSeason}
    />
  );
}