import { MlbView, type Query } from "@/app/leagues/mlb/Views";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) { return <MlbView view="players" query={await searchParams} />; }
