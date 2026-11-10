import type { Metadata } from "next";
export const metadata: Metadata = { title: "MLS | GamePulse", description: "MLS teams, players, fixtures, standings, statistics, and analytics." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-white">{children}</div>;
}
