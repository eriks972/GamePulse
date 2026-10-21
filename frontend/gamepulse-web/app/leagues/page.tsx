import Link from "next/link";

type League = {
  slug: string;
  name: string;
  sport: string;
  fullName: string;
  status: "live" | "coming-soon";
};

const leagues: League[] = [
  // Basketball
  {
    slug: "nba",
    name: "NBA",
    sport: "Basketball",
    fullName: "National Basketball Association",
    status: "live",
  },
  {
    slug: "wnba",
    name: "WNBA",
    sport: "Basketball",
    fullName: "Women’s National Basketball Association",
    status: "coming-soon",
  },
  {
    slug: "ncaamb",
    name: "NCAAM",
    sport: "Basketball",
    fullName: "NCAA Men’s Basketball",
    status: "coming-soon",
  },
  {
    slug: "ncaawb",
    name: "NCAAW",
    sport: "Basketball",
    fullName: "NCAA Women’s Basketball",
    status: "coming-soon",
  },
  {
    slug: "gleague",
    name: "NBA G League",
    sport: "Basketball",
    fullName: "NBA Development League",
    status: "coming-soon",
  },
  {
    slug: "euroleague",
    name: "EuroLeague",
    sport: "Basketball",
    fullName: "EuroLeague Basketball",
    status: "coming-soon",
  },

  // Football
  {
    slug: "nfl",
    name: "NFL",
    sport: "Football",
    fullName: "National Football League",
    status: "coming-soon",
  },
  {
    slug: "ncaaf",
    name: "NCAAF",
    sport: "Football",
    fullName: "NCAA College Football",
    status: "coming-soon",
  },
  {
    slug: "ufl",
    name: "UFL",
    sport: "Football",
    fullName: "United Football League",
    status: "coming-soon",
  },
  {
    slug: "cfl",
    name: "CFL",
    sport: "Football",
    fullName: "Canadian Football League",
    status: "coming-soon",
  },

  // Baseball
  {
    slug: "mlb",
    name: "MLB",
    sport: "Baseball",
    fullName: "Major League Baseball",
    status: "coming-soon",
  },
  {
    slug: "milb",
    name: "MiLB",
    sport: "Baseball",
    fullName: "Minor League Baseball",
    status: "coming-soon",
  },
  {
    slug: "ncaabaseball",
    name: "NCAA Baseball",
    sport: "Baseball",
    fullName: "College Baseball",
    status: "coming-soon",
  },
  {
    slug: "npb",
    name: "NPB",
    sport: "Baseball",
    fullName: "Nippon Professional Baseball",
    status: "coming-soon",
  },
  {
    slug: "kbo",
    name: "KBO",
    sport: "Baseball",
    fullName: "Korea Baseball Organization",
    status: "coming-soon",
  },

  // Hockey
  {
    slug: "nhl",
    name: "NHL",
    sport: "Hockey",
    fullName: "National Hockey League",
    status: "coming-soon",
  },
  {
    slug: "ahl",
    name: "AHL",
    sport: "Hockey",
    fullName: "American Hockey League",
    status: "coming-soon",
  },
  {
    slug: "ncaa-hockey",
    name: "NCAA Hockey",
    sport: "Hockey",
    fullName: "College Hockey",
    status: "coming-soon",
  },
  {
    slug: "pwhl",
    name: "PWHL",
    sport: "Hockey",
    fullName: "Professional Women’s Hockey League",
    status: "coming-soon",
  },

  // Soccer
  {
    slug: "mls",
    name: "MLS",
    sport: "Soccer",
    fullName: "Major League Soccer",
    status: "coming-soon",
  },
  {
    slug: "epl",
    name: "Premier League",
    sport: "Soccer",
    fullName: "English Premier League",
    status: "coming-soon",
  },
  {
    slug: "laliga",
    name: "La Liga",
    sport: "Soccer",
    fullName: "Spanish La Liga",
    status: "coming-soon",
  },
  {
    slug: "serie-a",
    name: "Serie A",
    sport: "Soccer",
    fullName: "Italian Serie A",
    status: "coming-soon",
  },
  {
    slug: "bundesliga",
    name: "Bundesliga",
    sport: "Soccer",
    fullName: "German Bundesliga",
    status: "coming-soon",
  },
  {
    slug: "ligue-1",
    name: "Ligue 1",
    sport: "Soccer",
    fullName: "French Ligue 1",
    status: "coming-soon",
  },
  {
    slug: "nwsl",
    name: "NWSL",
    sport: "Soccer",
    fullName: "National Women’s Soccer League",
    status: "coming-soon",
  },
  {
    slug: "champions-league",
    name: "Champions League",
    sport: "Soccer",
    fullName: "UEFA Champions League",
    status: "coming-soon",
  },
  {
    slug: "world-cup",
    name: "World Cup",
    sport: "Soccer",
    fullName: "FIFA World Cup",
    status: "coming-soon",
  },

  // Combat sports
  {
    slug: "ufc",
    name: "UFC",
    sport: "MMA",
    fullName: "Ultimate Fighting Championship",
    status: "coming-soon",
  },
  {
    slug: "boxing",
    name: "Boxing",
    sport: "Combat Sports",
    fullName: "Professional Boxing",
    status: "coming-soon",
  },
  {
    slug: "bellator",
    name: "Bellator",
    sport: "MMA",
    fullName: "Bellator MMA",
    status: "coming-soon",
  },
  {
    slug: "pfl",
    name: "PFL",
    sport: "MMA",
    fullName: "Professional Fighters League",
    status: "coming-soon",
  },

  // Racing
  {
    slug: "f1",
    name: "Formula 1",
    sport: "Racing",
    fullName: "FIA Formula One World Championship",
    status: "coming-soon",
  },
  {
    slug: "nascar",
    name: "NASCAR",
    sport: "Racing",
    fullName: "National Association for Stock Car Auto Racing",
    status: "coming-soon",
  },
  {
    slug: "indycar",
    name: "IndyCar",
    sport: "Racing",
    fullName: "IndyCar Series",
    status: "coming-soon",
  },
  {
    slug: "motogp",
    name: "MotoGP",
    sport: "Racing",
    fullName: "Grand Prix Motorcycle Racing",
    status: "coming-soon",
  },

  // Tennis / Golf
  {
    slug: "atp",
    name: "ATP",
    sport: "Tennis",
    fullName: "Association of Tennis Professionals",
    status: "coming-soon",
  },
  {
    slug: "wta",
    name: "WTA",
    sport: "Tennis",
    fullName: "Women’s Tennis Association",
    status: "coming-soon",
  },
  {
    slug: "pga",
    name: "PGA Tour",
    sport: "Golf",
    fullName: "Professional Golfers’ Association Tour",
    status: "coming-soon",
  },
  {
    slug: "lpga",
    name: "LPGA",
    sport: "Golf",
    fullName: "Ladies Professional Golf Association",
    status: "coming-soon",
  },
  {
    slug: "liv-golf",
    name: "LIV Golf",
    sport: "Golf",
    fullName: "LIV Golf League",
    status: "coming-soon",
  },

  // Other major sports
  {
    slug: "cricket",
    name: "Cricket",
    sport: "Cricket",
    fullName: "International and Domestic Cricket",
    status: "coming-soon",
  },
  {
    slug: "ipl",
    name: "IPL",
    sport: "Cricket",
    fullName: "Indian Premier League",
    status: "coming-soon",
  },
  {
    slug: "rugby",
    name: "Rugby",
    sport: "Rugby",
    fullName: "Rugby Union and Rugby League",
    status: "coming-soon",
  },
  {
    slug: "mlr",
    name: "MLR",
    sport: "Rugby",
    fullName: "Major League Rugby",
    status: "coming-soon",
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    sport: "Volleyball",
    fullName: "Professional and International Volleyball",
    status: "coming-soon",
  },
  {
    slug: "lacrosse",
    name: "PLL",
    sport: "Lacrosse",
    fullName: "Premier Lacrosse League",
    status: "coming-soon",
  },
  {
    slug: "esports",
    name: "Esports",
    sport: "Esports",
    fullName: "Competitive Gaming and Esports Analytics",
    status: "coming-soon",
  },
  {
    slug: "olympics",
    name: "Olympics",
    sport: "Multi-Sport",
    fullName: "Olympic Games",
    status: "coming-soon",
  },
];

const liveLeagues = leagues.filter((league) => league.status === "live");
const comingSoonLeagues = leagues.filter(
  (league) => league.status === "coming-soon",
);

function LeagueCard({ league }: { league: League }) {
  const isLive = league.status === "live";

  const cardContent = (
    <>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{league.name}</h2>

        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            isLive
              ? "bg-blue-500/10 text-blue-300"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {league.sport}
        </span>
      </div>

      <p className="mt-2 text-slate-400">{league.fullName}</p>

      <div className="mt-5 flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isLive
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-yellow-500/10 text-yellow-300"
          }`}
        >
          {isLive ? "Live Now" : "Coming Soon"}
        </span>

        <p
          className={`text-sm font-semibold ${
            isLive ? "text-blue-300" : "text-slate-500"
          }`}
        >
          {isLive ? "View League →" : "Preview"}
        </p>
      </div>
    </>
  );

  if (isLive) {
    return (
      <Link
        href={`/leagues/${league.slug}`}
        className="rounded-2xl border border-blue-500/40 bg-slate-900 p-5 shadow-lg transition hover:-translate-y-1 hover:border-blue-400"
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg opacity-80">
      {cardContent}
    </div>
  );
}

export default function LeaguesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-6xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-400">
            GamePulse
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
            Leagues & Sports
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            GamePulse is starting with NBA analytics and is built to expand
            across major sports, leagues, tournaments, and competitions.
          </p>
        </div>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Available Now</h2>
              <p className="mt-2 text-sm text-slate-400">
                Fully built league experiences currently live in GamePulse.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {liveLeagues.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div>
            <h2 className="text-2xl font-bold">Expansion Roadmap</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              These sports and leagues are planned as GamePulse grows. Future
              sections can include schedules, standings, team pages, player
              profiles, comparisons, analytics, and live-data upgrades.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {comingSoonLeagues.map((league) => (
              <LeagueCard key={league.slug} league={league} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}