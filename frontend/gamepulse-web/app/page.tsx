import Link from "next/link";

const availableLeagues = [
  { slug: "nba", name: "NBA", sport: "Basketball" },
  { slug: "wnba", name: "WNBA", sport: "Basketball" },
  { slug: "mlb", name: "MLB", sport: "Baseball" },
  { slug: "nfl", name: "NFL", sport: "Football" },
  { slug: "nhl", name: "NHL", sport: "Hockey" },
];

const platformStats = [
  { label: "Leagues", value: String(availableLeagues.length), description: "NBA, WNBA, MLB, NFL, and NHL in one place" },
  { label: "Sports", value: String(new Set(availableLeagues.map(league => league.sport)).size), description: "Basketball, baseball, football, and hockey" },
  { label: "Season Coverage", value: "Explore", description: "Browse available seasons, schedules, results, and standings" },
  { label: "Player Profiles", value: "Discover", description: "Find players and explore the statistics available for each league" },
];

const features = [
  {
    title: "Team Analytics",
    description:
      "Explore team records, season performance, and sport-specific metrics in the leagues with analytics coverage.",
    href: "/leagues?section=analytics",
    cta: "View Analytics",
  },
  {
    title: "Comparisons",
    description:
      "Explore side-by-side comparisons using the teams, players, seasons, and metrics available in your chosen league.",
    href: "/leagues?section=compare",
    cta: "Explore Comparisons",
  },
  {
    title: "Player Profiles",
    description:
      "Find players across basketball, baseball, football, and hockey, then explore their profiles and available season statistics.",
    href: "/leagues?section=players",
    cta: "Browse Players",
  },
  {
    title: "Game Breakdowns",
    description:
      "Browse league schedules, review results, and open game breakdowns with the scoring and statistics available for each sport.",
    href: "/leagues?section=schedule",
    cta: "View Schedule",
  },
];

const roadmapSports = [
  "College Basketball",
  "College Football",
  "MLS",
  "Premier League",
  "UFC",
  "Formula 1",
  "Tennis",
  "Golf",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-4xl border border-slate-800 bg-linear-to-br from-slate-900 via-slate-900 to-blue-950/40 p-8 shadow-xl md:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">
                GamePulse
              </p>

              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl xl:text-6xl">
                Your leagues. Your teams.
                A deeper view of the game.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                GamePulse is a sports analytics platform with NBA, WNBA, MLB, NFL, and NHL
                coverage. Discover teams, follow players, explore seasons, and
                compare performances with statistics tailored to each sport.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/leagues" className="rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400">
                  Explore All Leagues
                </Link>
                <Link href="/leagues?section=players" className="rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10">
                  Find Players
                </Link>
              </div>
            </div>

            <aside aria-labelledby="available-leagues" className="min-w-0 rounded-3xl border border-blue-500/30 bg-blue-950/30 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">Explore Now</p>
              <h2 id="available-leagues" className="mt-4 text-2xl font-black">Pick your league</h2>
              <p className="mt-3 leading-7 text-slate-300">Five leagues. Four sports. Find your next deep dive.</p>
              <div className="mt-6 grid gap-3">
                {availableLeagues.map(league => (
                  <Link key={league.slug} href={`/leagues/${league.slug}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 transition hover:border-blue-400">
                    <span className="font-bold">{league.name}<span className="ml-3 text-sm font-normal text-slate-400">{league.sport}</span></span>
                    <span aria-hidden="true" className="text-blue-300">→</span>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {platformStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <h2 className="mt-3 text-4xl font-black text-white">
                {stat.value}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {stat.description}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              Platform Features
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-4xl">
              What GamePulse includes
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-slate-400">
              Choose a feature, then select your league. Available statistics,
              comparisons, and analytics vary by league and season.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500"
              >
                <h3 className="text-2xl font-bold">{feature.title}</h3>

                <p className="mt-3 leading-7 text-slate-400">
                  {feature.description}
                </p>

                <p className="mt-5 text-sm font-bold text-blue-300">
                  {feature.cta} →
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-4xl border border-slate-800 bg-slate-900 p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
                Built to Expand
              </p>

              <h2 className="mt-3 text-3xl font-black md:text-4xl">
                Four sports today. More to explore tomorrow.
              </h2>

              <p className="mt-4 leading-7 text-slate-400">
                Explore NBA, WNBA, MLB, NFL, and NHL coverage today. The roadmap
                looks ahead to more professional, college, and international
                competitions.
              </p>

              <Link
                href="/leagues"
                className="mt-6 inline-flex rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10"
              >
                Explore League Roadmap
              </Link>
            </div>

            <div className="flex flex-wrap gap-3">
              {roadmapSports.map((sport) => (
                <span
                  key={sport}
                  className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-300"
                >
                  {sport}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">What is GamePulse?</h2>
            <p className="mt-3 leading-7 text-slate-400">
              GamePulse brings NBA analytics, WNBA history, MLB coverage, NFL seasons, and NHL analytics together.
              It combines historical schedules, team records, player profiles,
              game breakdowns, comparisons, and interactive analytics
              dashboards.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">Analytics Focused</h2>
            <p className="mt-3 leading-7 text-slate-400">
              The platform goes beyond simple scores by adding rankings,
              matchup context, visual charts, leaderboards, and custom
              season-based metrics.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-bold">Explore by Season</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Choose an available season to explore team records, player
              performances, and game results. Coverage and detail vary by
              league and season.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
