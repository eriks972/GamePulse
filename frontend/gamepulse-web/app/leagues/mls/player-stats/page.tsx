import { MlsView, type Query } from "@/app/leagues/mls/Views";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <MlsView view="player-stats" query={await searchParams} />;
}
