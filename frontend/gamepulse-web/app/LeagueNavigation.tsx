"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function LeagueNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const league = pathname.startsWith("/leagues/wnba") ? "wnba" : "nba";
  const season = params.get("season");
  const sections = league === "wnba"
    ? ["Teams", "Players", "Schedule", "Standings", "Team Stats", "Player Stats", "Compare"]
    : ["Teams", "Players", "Schedule", "Standings", "Compare", "Analytics"];
  const suffix = season ? `?season=${encodeURIComponent(season)}` : "";
  const links = [
    { label: "Home", href: "/" }, { label: "Leagues", href: "/leagues" },
    ...(league === "wnba" ? [] : [{ label: league.toUpperCase(), href: `/leagues/${league}${suffix}` }]),
    ...sections.map(label => ({ label, href: `/leagues/${league}/${label === "Team Stats" ? "team-stats" : label === "Player Stats" ? "player-stats" : label.toLowerCase()}${suffix}` })),
  ];
  return <div className="flex flex-wrap gap-2">{links.map(link => <Link
    key={link.label} href={link.href}
    aria-current={pathname === link.href.split("?")[0] ? "page" : undefined}
    className="rounded-full border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-300 aria-[current=page]:border-blue-400 aria-[current=page]:text-blue-300"
  >{link.label}</Link>)}</div>;
}
