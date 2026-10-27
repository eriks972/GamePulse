"use client";

import Link from "next/link";
import { leagueSections } from "@/lib/league-navigation";
import { usePathname, useSearchParams } from "next/navigation";

export default function LeagueNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const league = pathname.match(/^\/leagues\/(nba|wnba|mlb|nfl)(?:\/|$)/)?.[1];
  const season = params.get("season");
  const selectedSection = params.get("section");
  const suffix = season ? `?season=${encodeURIComponent(season)}` : "";
  const links = [
    { label: "Home", href: "/", active: pathname === "/" },
    { label: "Leagues", href: "/leagues", active: pathname === "/leagues" && !leagueSections.some(section => section.path === selectedSection) },
    ...leagueSections.filter(section => !league || section.leagues.includes(league)).map(section => {
      const href = league
        ? `/leagues/${league}/${section.path}${suffix}`
        : `/leagues?section=${section.path}`;
      return {
        label: section.label,
        href,
        active: league
          ? pathname === `/leagues/${league}/${section.path}` || pathname.startsWith(`/leagues/${league}/${section.path}/`)
          : pathname === "/leagues" && selectedSection === section.path,
      };
    }),
  ];
  return <div className="flex flex-wrap gap-2">{links.map(link => <Link
    key={link.label} href={link.href}
    aria-current={link.active ? "page" : undefined}
    className="rounded-full border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-300 aria-[current=page]:border-blue-400 aria-[current=page]:text-blue-300"
  >{link.label}</Link>)}</div>;
}
