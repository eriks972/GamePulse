import type { Metadata } from "next";
export const metadata: Metadata = { title: "NFL | GamePulse", description: "NFL schedules, teams, players, game statistics, and season records from validated batch snapshots." };
export default function NflLayout({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-slate-950 text-white">{children}</div>; }
