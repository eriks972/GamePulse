import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GamePulse",
  description: "A multi-sport analytics platform starting with NBA coverage.",
};

const navLinks = [
  { label: "NBA", href: "/leagues/nba" },
  { label: "Teams", href: "/leagues/nba/teams" },
  { label: "Players", href: "/leagues/nba/players" },
  { label: "Schedule", href: "/leagues/nba/schedule" },
  { label: "Standings", href: "/leagues/nba/standings" },
  { label: "Compare", href: "/leagues/nba/compare" },
  { label: "Analytics", href: "/leagues/nba/analytics" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="group">
              <div className="text-xl font-black tracking-tight">
                Game<span className="text-blue-400">Pulse</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 group-hover:text-blue-400">
                Sports Analytics
              </p>
            </Link>

            <div className="flex flex-wrap gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}
