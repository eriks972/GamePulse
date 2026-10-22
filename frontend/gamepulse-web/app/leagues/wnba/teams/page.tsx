import { WnbaView, type Query } from "@/app/leagues/wnba/Views";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <WnbaView view="teams" query={await searchParams} />;
}
