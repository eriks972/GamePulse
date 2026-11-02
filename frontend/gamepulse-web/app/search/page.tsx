import type { Metadata } from "next";
import SearchClient from "./SearchClient";
import { EMPTY_SEARCH, isSearchLeague, readSearch, type SearchQuery } from "@/lib/search";

export const metadata: Metadata = { title: "Search Players & Teams | GamePulse", description: "Find players and teams across NBA, WNBA, MLB, NFL, and NHL seasons." };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["q", "league", "kind", "season"]) if (typeof values[key] === "string") params.set(key, values[key]);
  let initial: SearchQuery = { ...EMPTY_SEARCH };
  let initialError = "";
  if (params.get("q")) {
    try { initial = readSearch(params); }
    catch (e) { initialError = e instanceof Error ? e.message : "Invalid search link."; }
  } else {
    const league = params.get("league") || "";
    initial = { ...initial, league: isSearchLeague(league) ? league : "all", season: /^\d{4}$/.test(params.get("season") || "") ? params.get("season")! : "" };
  }
  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-6xl">
    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">GamePulse · Five leagues</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Find your next deep dive.</h1>
    <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">Search players and teams across the NBA, WNBA, MLB, NFL, and NHL. Choose a season and open a profile to explore the data available.</p>
    <SearchClient key={params.toString()} initial={initial} initialError={initialError} />
  </div></main>;
}
