"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_SEARCH, isSearchLeague, readSearch, SEARCH_LEAGUES, SEARCH_LIMIT, searchParams, searchSeasonLabel, type SearchGroup, type SearchQuery } from "@/lib/search";

const input = "w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white focus:outline-2 focus:outline-blue-400";
const button = "rounded-xl bg-blue-500 px-5 py-3 font-bold text-white hover:bg-blue-400 focus:outline-2 focus:outline-offset-2 focus:outline-blue-300";
export default function SearchClient({ initial = EMPTY_SEARCH, initialError = "" }: { initial?: SearchQuery; initialError?: string }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(initialError);
  const [submitted, setSubmitted] = useState<SearchQuery | null>(null);
  const [groups, setGroups] = useState<Partial<Record<typeof SEARCH_LEAGUES[number], SearchGroup>>>({});
  const [loading, setLoading] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const runSearch = useCallback(async (draft: SearchQuery, updateUrl = true) => {
    controller.current?.abort();
    const id = ++generation.current;
    setGroups({}); setLoading([]); setSubmitted(null);
    let query: SearchQuery;
    try { query = readSearch(searchParams(draft)); }
    catch (e) { setError(e instanceof Error ? e.message : "Check your search."); return; }
    setError(""); setSubmitted(query);
    if (updateUrl) window.history.pushState(null, "", "/search?" + searchParams(query));
    const active = new AbortController(); controller.current = active;
    const leagues = query.league === "all" ? [...SEARCH_LEAGUES] : [query.league];
    setLoading(leagues);
    await Promise.all(leagues.map(async league => {
      let result: SearchGroup;
      try {
        const params = searchParams({ ...query, league });
        const response = await fetch("/api/search?" + params, { signal: active.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Request failed");
        result = await response.json() as SearchGroup;
        if (result.league !== league || !Array.isArray(result.hits)) throw new Error("Invalid response");
      } catch {
        result = { league, season: null, availableSeasons: [], status: "unavailable", hits: [], messages: ["This league is temporarily unavailable. Retry this search."], morePlayers: false, moreTeams: false };
      }
      if (generation.current !== id || active.signal.aborted) return;
      setGroups(previous => ({ ...previous, [league]: result }));
      setLoading(previous => previous.filter(item => item !== league));
    }));
  }, []);
  const reset = useCallback(() => {
    controller.current?.abort(); ++generation.current;
    setForm(EMPTY_SEARCH); setGroups({}); setLoading([]); setSubmitted(null); setError("");
    window.history.pushState(null, "", "/search");
  }, []);
  useEffect(() => {
    let disposed = false;
    // Defer URL-driven initial loading until hydration finishes. Strict Mode's
    // discarded effect cannot start a duplicate request.
    queueMicrotask(() => { if (!disposed && initial.q && !initialError) void runSearch(initial, false); });
    const abort = () => controller.current?.abort();
    const pop = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("q")) {
        controller.current?.abort(); ++generation.current;
        setForm(EMPTY_SEARCH); setGroups({}); setLoading([]); setSubmitted(null); setError("");
        return;
      }
      try { const query = readSearch(params); setForm(query); void runSearch(query, false); }
      catch (e) { controller.current?.abort(); ++generation.current; setLoading([]); setGroups({}); setSubmitted(null); setError(e instanceof Error ? e.message : "Invalid search link."); }
    };
    window.addEventListener("popstate", pop);
    return () => { disposed = true; abort(); window.removeEventListener("popstate", pop); };
  }, [initial, initialError, runSearch]);
  const selectedLeagues = submitted?.league === "all" ? SEARCH_LEAGUES : submitted && isSearchLeague(submitted.league) ? [submitted.league] : [];
  return <>
    <form className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6" onSubmit={event => { event.preventDefault(); void runSearch(form); }}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="grid min-w-0 gap-2 font-semibold" htmlFor="universal-name">Player or team name<input id="universal-name" name="q" className={input} value={form.q} maxLength={80} onChange={event => setForm({ ...form, q: event.target.value })} placeholder="e.g. Jordan, New York, NYY" autoComplete="off" /></label>
        <label className="grid min-w-0 gap-2 font-semibold" htmlFor="universal-league">League<select id="universal-league" className={input} value={form.league} onChange={event => setForm({ ...form, league: event.target.value as SearchQuery["league"] })}><option value="all">All leagues</option>{SEARCH_LEAGUES.map(league => <option key={league} value={league}>{league.toUpperCase()}</option>)}</select></label>
        <label className="grid min-w-0 gap-2 font-semibold" htmlFor="universal-kind">Find<select id="universal-kind" className={input} value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as SearchQuery["kind"] })}><option value="all">Players and teams</option><option value="players">Players</option><option value="teams">Teams</option></select></label>
        <label className="grid min-w-0 gap-2 font-semibold" htmlFor="universal-season">Season year<input id="universal-season" className={input} value={form.season} inputMode="numeric" maxLength={4} onChange={event => setForm({ ...form, season: event.target.value })} placeholder="Latest per league" aria-describedby="season-help" /></label>
      </div>
      <p id="season-help" className="mt-4 text-sm leading-6 text-slate-400">Leave the year blank for each league’s latest imported season. NHL uses the ending year: enter 2025 for 2024–25. Search updates when you press Search.</p>
      <div className="mt-5 flex flex-wrap gap-3"><button className={button} type="submit">Search</button><button className="rounded-xl border border-slate-600 px-5 py-3 font-semibold hover:border-blue-400" type="button" onClick={reset}>Reset search</button></div>
      {error && <p role="alert" className="mt-4 text-amber-300">{error}</p>}
    </form>
    {!submitted && !error && <p className="mt-8 text-slate-300">Enter at least two characters to search the imported player and team indexes.</p>}
    {submitted && <section className="mt-8" aria-labelledby="search-results-title">
      <h2 id="search-results-title" className="break-words text-2xl font-bold">Results for “{submitted.q}”</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{submitted.league === "all" ? "All five leagues" : submitted.league.toUpperCase()} · {submitted.kind === "all" ? "Players and teams" : submitted.kind === "players" ? "Players" : "Teams"} · {submitted.season || "Latest imported season per league"}. Up to {SEARCH_LIMIT} results of each type per league. A profile match does not guarantee complete game statistics.</p>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-blue-300">{loading.length ? `Searching ${loading.map(league => league.toUpperCase()).join(", ")}… Results appear as each league responds.` : "Search complete."}</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {selectedLeagues.map(league => {
          const group = groups[league];
          return <section key={league} className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-label={`${league.toUpperCase()} search results`}>
            <h3 className="text-xl font-bold">{league.toUpperCase()}{group?.season && <span className="ml-2 text-base font-normal text-slate-400">{searchSeasonLabel(league, group.season)}</span>}</h3>
            {!group ? <p className="mt-4 text-slate-400">Searching… The backend may take a moment to wake up.</p> : <>
              {group.messages.map(message => <p key={message} className={`mt-3 text-sm leading-6 ${group.status === "ok" ? "text-slate-400" : "text-amber-300"}`}>{message}</p>)}
              {group.status === "missing-season" && group.availableSeasons.length > 0 && <p className="mt-3 text-sm text-slate-300">Recent imported years: {group.availableSeasons.slice(0, 6).join(", ")}. Change the year or leave it blank.</p>}
              {group.status === "ok" && !group.hits.length && <p className="mt-4 text-slate-300">No matching {submitted.kind === "all" ? "players or teams" : submitted.kind} in this season. Try another name, league, or season.</p>}
              {group.hits.length > 0 && <ul className="mt-4 space-y-3">{group.hits.map(hit => <li key={`${hit.kind}/${hit.id}`}><Link prefetch={false} href={hit.href} className="block rounded-2xl border border-slate-700 p-4 transition hover:border-blue-400 hover:bg-slate-800 focus:outline-2 focus:outline-blue-400"><span className="block break-words font-bold text-blue-300">{hit.name}</span><span className="mt-1 block text-sm text-slate-400">{hit.kind === "players" ? hit.seasonScoped === false ? "Player catalog" : "Player" : "Team"}{hit.detail ? ` · ${hit.detail}` : ""} · {hit.seasonScoped === false ? "Season statistics not verified" : searchSeasonLabel(league, group.season!)}</span></Link></li>)}</ul>}
              {group.morePlayers && <p className="mt-3 text-sm text-slate-400">More player matches exist. Narrow the name to see a different set.</p>}
              {group.moreTeams && <p className="mt-3 text-sm text-slate-400">More team matches exist. Narrow the name to see a different set.</p>}
              {group.season && <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link prefetch={false} className="text-blue-300 underline" href={`/leagues/${league}/players?season=${group.season}`}>Browse {league.toUpperCase()} players</Link><Link prefetch={false} className="text-blue-300 underline" href={`/leagues/${league}/teams?season=${group.season}`}>Browse {league.toUpperCase()} teams</Link></div>}
            </>}
          </section>;
        })}
      </div>
      {!loading.length && <button type="button" className="mt-6 rounded-xl border border-slate-600 px-5 py-3 font-semibold hover:border-blue-400" onClick={() => void runSearch(submitted, false)}>Retry search</button>}
    </section>}
  </>;
}
