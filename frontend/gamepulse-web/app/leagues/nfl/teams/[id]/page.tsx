import { NflView, type Query } from "@/app/leagues/nfl/Views";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  return <NflView view="team" id={(await params).id} query={await searchParams} />;
}
