import { getNbaSeasons, getNbaStandings, getNbaTeamStats } from "@/lib/api";
import CompareTeamsClient from "./compareClient";

type NbaComparePageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function NbaComparePage({
  searchParams,
}: NbaComparePageProps) {
  const params = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = params?.season || seasons[0];

  const teams = await getNbaStandings(selectedSeason);
  const teamStats = await getNbaTeamStats(selectedSeason);

  return <CompareTeamsClient teams={teams} seasons={seasons} selectedSeason={selectedSeason} teamStats={teamStats} />;
}