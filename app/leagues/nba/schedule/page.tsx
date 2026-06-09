import { getNbaGames, getNbaSeasons } from "@/lib/api";
import ScheduleClient from "./scheduleClient";

export const dynamic = "force-dynamic";

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
  const selectedSeason = params?.season || seasons[0] || "2022";

  console.log("Schedule selected season:", selectedSeason);

  const games = await getNbaGames(selectedSeason);

  return (
    <ScheduleClient
      games={games}
      seasons={seasons}
      selectedSeason={selectedSeason}
    />
  );
}