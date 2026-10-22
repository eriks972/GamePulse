import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "MLB | GamePulse",
  description: "Explore MLB teams, players, schedules, game statistics, and regular-season records.",
};
export default function MlbLayout({children}:{children:React.ReactNode}) {
  return <div className="min-h-screen bg-slate-950 text-white">{children}</div>;
}
