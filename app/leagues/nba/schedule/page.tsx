import { getNbaGames, getNbaSeasons } from "@/lib/api";
import ScheduleClient from "./scheduleClient";

type NbaSchedulePageProps = {
  searchParams?: Promise<{
    season?: string;
  }>;
};

export default async function NbaSchedulePage({
  searchParams,
}: NbaSchedulePageProps) {
  const params = await searchParams;

  const seasons = await getNbaSeasons();
  const selectedSeason = params?.season || seasons[0];

  const games = await getNbaGames(selectedSeason);

  return (
    <ScheduleClient
      games={games}
      seasons={seasons}
      selectedSeason={selectedSeason}
    />
  );
}