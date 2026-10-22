import { WnbaView, type Query } from "@/app/leagues/wnba/Views";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams, params }: { searchParams: Promise<Query>; params: Promise<{ id: string }> }) {
  return <WnbaView view="player" query={await searchParams} id={(await params).id} />;
}
