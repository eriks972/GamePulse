import { getNbaSeasons, getNbaStandings } from "@/lib/api";
import TeamsClient from "./teamClient";

type NbaTeamsPageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function NbaTeamsPage({ searchParams }: NbaTeamsPageProps) {
  const params = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = params?.season || seasons[0];

  const teams = await getNbaStandings(selectedSeason);

  return (
    <TeamsClient
      teams={teams}
      seasons={seasons}
      selectedSeason={selectedSeason}
    />
  );
}