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

  let seasons: string[] = [];

  try {
    seasons = await getNbaSeasons();
  } catch (error) {
    console.error("Schedule seasons failed", error);
    seasons = ["2022"];
  }

  const selectedSeason = params?.season || seasons[0] || "2022";

  const games = await getNbaGames(selectedSeason);

  return (
    <ScheduleClient
      games={games}
      seasons={seasons}
      selectedSeason={selectedSeason}
    />
  );
}