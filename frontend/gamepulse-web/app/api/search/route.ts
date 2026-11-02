import { isSearchLeague, readSearch } from "@/lib/search";
import { searchLeague } from "@/lib/search-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const query = readSearch(params);
    if (!isSearchLeague(query.league)) return Response.json({ message: "Choose one league per search request." }, { status: 400 });
    const result = await searchLeague(query, query.league, request.signal);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Invalid search." }, { status: 400 });
  }
}
