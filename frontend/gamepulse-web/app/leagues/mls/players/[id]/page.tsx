import { MlsView, type Query } from "@/app/leagues/mls/Views";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  return <MlsView view="player" id={(await params).id} query={await searchParams} />;
}
