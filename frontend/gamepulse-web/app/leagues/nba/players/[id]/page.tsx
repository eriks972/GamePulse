import Link from "next/link";
import { Suspense } from "react";
import { getNbaPlayerById } from "@/lib/api";
import type { NbaStatsQuery } from "@/lib/nba-player-statistics";
import NbaCatalogNotice from "../NbaCatalogNotice";
import NbaPlayerStatistics from "../NbaPlayerStatistics";
import ProfileAccordion from "../ProfileAccordion";

type PlayerDetailPageProps = { params: Promise<{ id: string }>; searchParams: Promise<NbaStatsQuery> };
function formatCareer(from: number, to: number) {
  if (!from && !to) return "Career dates unavailable";
  return from === to ? String(from) : `${from}–${to}`;
}
function formatDraft(year: string, round: string, pick: string) {
  if (!year) return "Not supplied";
  if (year === "Undrafted") return "Undrafted";
  return [year, round ? `Round ${round}` : "", pick ? `Pick ${pick}` : ""].filter(Boolean).join(" · ");
}

export default async function PlayerDetailPage({ params, searchParams }: PlayerDetailPageProps) {
  const { id } = await params;
  const [player, query] = await Promise.all([getNbaPlayerById(id), searchParams]);
  if (!player) return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><section className="mx-auto max-w-6xl"><Link href="/leagues/nba/players" className="text-sm text-blue-300">Back to NBA Players</Link><h1 className="mt-8 text-3xl font-bold">Player not found</h1><p className="mt-3 text-slate-400">This player could not be found in the processed NBA player dataset.</p></section></main>;
  const teamLabel = player.teamName ? `${player.teamCity} ${player.teamName}`.trim() : "No team listed";
  const heightWeight = [player.height, player.weight > 0 ? `${player.weight} lbs` : ""].filter(Boolean).join(" · ") || "Not supplied";
  const bio = [
    ["Height / weight", heightWeight], ["Country", player.country || "Not supplied"],
    ["Birthdate", player.birthdate || "Not supplied"], ["School / prior club", player.school || "Not supplied"],
    ["Affiliation", player.lastAffiliation || "Not supplied"], ["Draft", formatDraft(player.draftYear, player.draftRound, player.draftNumber)],
    ["Experience", player.catalogUpdatedAt || !player.seasonExperience ? "Not supplied" : `${player.seasonExperience} seasons`],
    ["NBA 75 selection", player.greatest75 ? "Yes" : "No"], ["NBA player ID", String(player.id)],
    ["NBA player", player.nba ? "Yes" : "No"], ["Career appearances recorded", player.gamesPlayed ? "Yes" : "No"],
    ["G League", player.dLeague ? "Yes" : "No"], ["Directory team abbreviation", player.teamAbbreviation || "Not supplied"],
    ["Directory team code", player.teamCode || "Not supplied"],
  ];
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/leagues/nba/players" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-blue-300"><span aria-hidden="true">←</span>Back to NBA Players</Link>
        <header className="mt-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-medium tracking-widest text-blue-300">NBA · PLAYER PROFILE</p><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${player.rosterStatus === "Active" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>{player.rosterStatus || "Status unknown"}</span>{player.greatest75 && <span className="text-xs text-amber-200">NBA 75</span>}</div>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0"><h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{player.fullName}</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">{[player.position || "Position unavailable", player.jersey ? `#${player.jersey}` : "", formatCareer(player.fromYear, player.toYear)].filter(Boolean).join(" · ")}</p><p className="mt-3 text-sm text-slate-300"><span className="text-slate-500">Directory team</span><span className="mx-2 text-slate-600" aria-hidden="true">/</span>{teamLabel}</p></div>
            <div className="flex shrink-0 flex-wrap gap-2"><Link href={player.externalTeamId > 0 ? `/leagues/nba/teams/${player.externalTeamId}` : "/leagues/nba/teams"} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-400/60 hover:text-blue-300">{player.externalTeamId > 0 ? "View team" : "Browse teams"}</Link><Link href="/leagues/nba/analytics" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-400/60 hover:text-blue-300">Analytics</Link></div>
          </div>
        </header>

        <Suspense fallback={<div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">Loading season statistics…</div>}>
          <NbaPlayerStatistics id={player.id} query={query} />
        </Suspense>

        <div className="mt-4 space-y-4">
          <ProfileAccordion title="Player details" description="Biography, draft information, and player identifiers">
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">{bio.map(([label, value]) => <div key={label} className="min-w-0 border-b border-slate-800/70 py-4"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium leading-relaxed text-slate-200">{value}</dd></div>)}</dl>
          </ProfileAccordion>
          <ProfileAccordion title="Directory snapshot" description="Roster information and catalog coverage">
            <div className="[&_aside]:mt-0"><NbaCatalogNotice players={[player]} /></div>
          </ProfileAccordion>
        </div>
      </div>
    </main>
  );
}
