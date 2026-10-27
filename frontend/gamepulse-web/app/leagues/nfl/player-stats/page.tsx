import { NflView, type Query } from "@/app/leagues/nfl/Views";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <NflView view="player-stats" query={await searchParams} />;
}
