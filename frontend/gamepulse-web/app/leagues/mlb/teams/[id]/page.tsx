import { MlbView, type Query } from "@/app/leagues/mlb/Views";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams, params }: { searchParams: Promise<Query>; params: Promise<{ id: string }> }) { return <MlbView view="team" query={await searchParams} id={(await params).id} />; }
