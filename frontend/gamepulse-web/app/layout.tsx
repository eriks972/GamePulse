import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import LeagueNavigation from "./LeagueNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "GamePulse",
  description: "A multi-sport analytics platform with NBA, WNBA, MLB, and NFL coverage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 text-white backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="group">
              <div className="text-xl font-black tracking-tight">
                Game<span className="text-blue-400">Pulse</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 group-hover:text-blue-400">
                Sports Analytics
              </p>
            </Link>

            <Suspense fallback={<Link href="/leagues">Leagues</Link>}>
              <LeagueNavigation />
            </Suspense>
          </nav>
        </header>

        {children}
        <Analytics />
      </body>
    </html>
  );
}
