import Link from "next/link";

const platformStats = [
  {
    label: "NBA Teams",
    value: "30",
    description: "Team profiles, standings, comparisons, and analytics",
  },
  {
    label: "NBA Players",
    value: "4,171",
    description: "Searchable player index with detailed player profiles",
  },
  {
    label: "Historical Games",
    value: "1,200+",
    description: "Season-based schedules, results, and game breakdowns",
  },
  {
    label: "Live Backend",
    value: "Azure",
    description: "ASP.NET Core API deployed with Docker and Container Apps",
  },
];

const features = [
  {
    title: "Team Analytics",
    description:
      "Explore NBA team records, season performance, scoring trends, defensive rankings, and shooting efficiency.",
    href: "/leagues/nba/analytics",
    cta: "View Analytics",
  },
  {
    title: "Team Comparisons",
    description:
      "Compare two NBA teams side by side using records, rankings, scoring, defense, rebounding, assists, and shooting metrics.",
    href: "/leagues/nba/compare",
    cta: "Compare Teams",
  },
  {
    title: "Player Profiles",
    description:
      "Search NBA players by name, team, country, school, position, roster status, and career era.",
    href: "/leagues/nba/players",
    cta: "Browse Players",
  },
  {
    title: "Game Breakdowns",
    description:
      "Review historical NBA game results with final scores, matchup context, and quarter-by-quarter line score data.",
    href: "/leagues/nba/schedule",
    cta: "View Schedule",
  },
];

const roadmapSports = [
  "NFL",
  "MLB",
  "NHL",
  "WNBA",
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

              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
                Sports analytics built for fans, comparisons, and data-driven
                insights.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                GamePulse is a multi-sport analytics platform starting with NBA
                coverage. The live MVP includes teams, players, schedules,
                standings, comparisons, game breakdowns, and interactive
                analytics dashboards.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/leagues/nba"
                  className="rounded-full bg-blue-500 px-6 py-3 font-bold text-white transition hover:bg-blue-400"
                >
                  Open NBA Dashboard
                </Link>

                <Link
                  href="/leagues"
                  className="rounded-full border border-blue-500/40 px-6 py-3 font-bold text-blue-300 transition hover:bg-blue-500/10"
                >
                  View All Leagues
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/30 bg-blue-950/30 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
                Live Now
              </p>

              <h2 className="mt-4 text-3xl font-black">NBA Analytics</h2>

              <p className="mt-3 leading-7 text-slate-300">
                The first complete GamePulse league experience is live with
                historical NBA data, team stats, player profiles, and charts.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Teams</p>
                  <p className="mt-1 text-2xl font-black">30</p>
                </div>

                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Players</p>
                  <p className="mt-1 text-2xl font-black">4,171</p>
                </div>

                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Charts</p>
                  <p className="mt-1 text-2xl font-black">5+</p>
                </div>

                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Status</p>
                  <p className="mt-1 text-2xl font-black text-emerald-300">
                    Live
                  </p>
                </div>
              </div>
            </div>
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
              The first release focuses on building a strong NBA analytics
              foundation before expanding into more sports and live data.
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
                NBA first. More sports next.
              </h2>

              <p className="mt-4 leading-7 text-slate-400">
                GamePulse is structured as a league-based platform. NBA is live
                now, and the roadmap includes major professional, college, and
                international sports.
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
              GamePulse is a sports analytics platform starting with NBA data.
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
            <h2 className="text-2xl font-bold">Production Deployed</h2>
            <p className="mt-3 leading-7 text-slate-400">
              The frontend is deployed on Vercel, while the ASP.NET Core API is
              containerized with Docker and hosted on Azure Container Apps.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}