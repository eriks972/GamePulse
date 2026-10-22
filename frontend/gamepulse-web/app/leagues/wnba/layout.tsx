import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WNBA | GamePulse",
  description: "Explore WNBA seasons, teams, players, game results, and available box scores.",
};

export default function WnbaLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-white">{children}</div>;
}
