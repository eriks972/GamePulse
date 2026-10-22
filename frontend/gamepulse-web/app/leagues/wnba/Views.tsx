import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerSeasonTable, PlayerSeasonSummary } from "./PlayerSeasonTable";
import { StandingsTable, TeamStatisticsTable, TeamSeasonSummary } from "./SeasonTables";
import {
  wnba, WnbaApiError, entityPath, wnbaHref, gameDate, statValue,
  type WnbaTeam, type WnbaPlayer, type WnbaGame, type WnbaStat,
  type WnbaStatistics, type WnbaCoverage, type PlayerGame,
} from "@/lib/wnba";

export type Query = Record<string, string | string[] | undefined>;
export type View = "dashboard" | "teams" | "players" | "schedule" | "team" | "player" | "game" | "standings" | "team-stats" | "player-stats";
const panel = "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl";
const input = "rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const link = "font-semibold text-blue-300 hover:text-blue-200 hover:underline";
const value = (query: Query, name: string) => typeof query[name] === "string" ? query[name] as string : "";
const name = (team: WnbaTeam) => team.name || team.abbreviation || "Team name unavailable";
const playerName = (player: WnbaPlayer) => player.fullName || "Player name unavailable";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-400">{children}</p>;
}

function Header({ title, seasons, season, route = "" }: { title: string; seasons: string[]; season: string; route?: string }) {
  return <div className={`${panel} bg-linear-to-br from-slate-900 to-blue-950/40`}>
    <Link href="/leagues" className={link}>← All leagues</Link>
    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">GamePulse WNBA · {season}</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">{title}</h1>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
      <nav aria-label="WNBA sections" className="flex flex-wrap gap-4">
        {[["", "Overview"], ["teams", "Teams"], ["players", "Players"], ["schedule", "Schedule & Results"], ["standings", "Standings"], ["team-stats", "Team Stats"], ["player-stats", "Player Stats"]].map(([path, label]) =>
          <Link className={link} key={path} href={wnbaHref(path, season)}>{label}</Link>)}
      </nav>
      <form action={wnbaHref(route)} className="flex flex-wrap items-center gap-3">
        <label htmlFor="season" className="text-sm text-slate-300">Season</label>
        <select id="season" name="season" defaultValue={season} className={input}>
          {seasons.map(year => <option key={year}>{year}</option>)}
        </select>
        <button className="rounded-xl bg-blue-500 px-4 py-2 font-bold hover:bg-blue-400">Load season</button>
      </form>
    </div>
  </div>;
}

function Filters({ query, season, teams, players = false, action }: {
  query: Query; season: string; teams: WnbaTeam[]; players?: boolean; action: string;
}) {
  return <form action={action} className={`${panel} flex flex-wrap items-end gap-4`}>
    <input type="hidden" name="season" value={season} />
    {players && <label className="grid gap-2 text-sm text-slate-300">Player name
      <input className={input} name="search" placeholder="Search players" defaultValue={value(query, "search")} />
    </label>}
    <label className="grid gap-2 text-sm text-slate-300">Team
      <select name="teamId" defaultValue={value(query, "teamId")} className={input}>
        <option value="">All teams</option>{teams.map(team => <option key={team.id} value={team.id}>{name(team)}</option>)}
      </select>
    </label>
    {!players && <>
      <label className="grid gap-2 text-sm text-slate-300">Season type
        <select name="seasonType" className={input} defaultValue={value(query, "seasonType")}>
          <option value="">All types</option>{["Regular Season", "Playoffs", "Preseason", "Offseason"].map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm text-slate-300">Game date
        <input className={input} type="date" name="date" defaultValue={value(query, "date")} />
      </label>
    </>}
    <button className="rounded-xl bg-blue-500 px-5 py-2 font-bold hover:bg-blue-400">Apply filters</button>
    <Link href={wnbaHref(players ? "players" : "schedule", season)} className={link}>Reset</Link>
  </form>;
}

function pageItems<T>(items: T[], query: Query) {
  const pages = Math.max(1, Math.ceil(items.length / 40));
  const requested = Number(value(query, "page"));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1));
  return { items: items.slice((page - 1) * 40, page * 40), page, pages };
}
function Pagination({ page, pages, query, path, season }: { page: number; pages: number; query: Query; path: string; season: string }) {
  if (pages <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(query)) if (typeof val === "string") params.set(key, val);
    params.set("season", season); params.set("page", String(target));
    return `/leagues/wnba/${path}?${params}`;
  };
  return <nav aria-label="Pagination" className="mt-6 flex justify-center gap-6">
    {page > 1 && <Link href={href(page - 1)} className={link}>← Previous</Link>}
    <span className="text-slate-400">Page {page} of {pages}</span>
    {page < pages && <Link href={href(page + 1)} className={link}>Next →</Link>}
  </nav>;
}

function Games({ games, season }: { games: WnbaGame[]; season: string }) {
  if (!games.length) return <Empty>No games match this selection.</Empty>;
  return <div className="grid gap-4 md:grid-cols-2">{games.map(game =>
    <Link href={wnbaHref(`game/${encodeURIComponent(game.id)}`, season)} key={game.id}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-400">
      <div className="flex justify-between gap-3 text-sm text-slate-400"><span>{gameDate(game.gameDate)}</span>
        <span className={game.completed ? "text-emerald-300" : "text-slate-400"}>{game.status}</span></div>
      <p className="mt-1 text-xs text-slate-500">{game.seasonType}</p>
      <div className="mt-4 flex justify-between gap-4 font-bold"><span>{game.awayTeamName || "Away team"}</span><span>{statValue(game.awayScore)}</span></div>
      <div className="mt-3 flex justify-between gap-4 font-bold"><span>{game.homeTeamName || "Home team"}</span><span>{statValue(game.homeScore)}</span></div>
      <p className="mt-4 text-sm font-semibold text-blue-300">Game details →</p>
    </Link>)}</div>;
}

function TeamLinks({ ids, teams, season }: { ids: string[]; teams: WnbaTeam[]; season: string }) {
  if (!ids.length) return <span className="text-slate-500">No participation recorded</span>;
  return <span className="flex flex-wrap gap-x-3 gap-y-1">{ids.map(id => <Link key={id} className={link}
    href={wnbaHref(entityPath("teams", id), season)}>{teams.find(t => t.id === id)?.name || "Team"}</Link>)}</span>;
}

function Players({ players, teams, season }: { players: WnbaPlayer[]; teams: WnbaTeam[]; season: string }) {
  if (!players.length) return <Empty>No players found for this selection.</Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{players.map(player => <article className={panel} key={player.id}>
    <Link className="text-lg font-bold text-blue-300 hover:underline" href={wnbaHref(entityPath("players", player.id), season)}>{playerName(player)}</Link>
    <p className="mt-1 text-sm text-slate-400">{player.position || "Position unavailable"}</p>
    <div className="mt-4 text-sm"><TeamLinks ids={player.teamIds} teams={teams} season={season} /></div>
    {!player.teamIds.length && player.rosterSnapshotTeamIds.length > 0 && <div className="mt-2 text-sm text-slate-400">Roster snapshot: <TeamLinks ids={player.rosterSnapshotTeamIds} teams={teams} season={season} /></div>}
  </article>)}</div>;
}

const columns = [["points", "PTS"], ["rebounds", "REB"], ["assists", "AST"], ["steals", "STL"], ["blocks", "BLK"], ["turnovers", "TO"], ["fouls", "PF"], ["minutes", "MIN"], ["plusMinus", "+/−"]];
function Shooting({ stats, made, attempted }: { stats: Record<string, number | null>; made: string; attempted: string }) {
  return <>{statValue(stats[made])}/{statValue(stats[attempted])}</>;
}
function BoxScore({ rows, season, player = false, title }: { rows: WnbaStat[]; season: string; player?: boolean; title: string }) {
  return <section className={panel}>
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="mt-2 text-sm text-slate-400">A dash means the value is unavailable. Shooting columns show made/attempted.</p>
    {!rows.length ? <div className="mt-5"><Empty>Statistics unavailable for this game.</Empty></div> :
      <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="text-slate-400"><tr><th className="p-3" scope="col">{player ? "Player" : "Team"}</th>
          {columns.map(([, label]) => <th key={label} className="p-3 text-right" scope="col">{label}</th>)}
          {["FG", "3PT", "FT"].map(label => <th key={label} className="p-3 text-right" scope="col">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr className="border-t border-slate-800" key={`${row.teamId}-${row.playerId || "team"}`}>
          <th scope="row" className="p-3"><Link className={link} href={wnbaHref(entityPath(player ? "players" : "teams", player ? row.playerId! : row.teamId), season)}>
            {player ? row.playerName || "Player" : row.teamName || "Team"}</Link></th>
          {columns.map(([key]) => <td key={key} className="p-3 text-right tabular-nums">{statValue(row.statistics[key])}</td>)}
          <td className="p-3 text-right"><Shooting stats={row.statistics} made="fieldGoalsMade" attempted="fieldGoalsAttempted" /></td>
          <td className="p-3 text-right"><Shooting stats={row.statistics} made="threePointersMade" attempted="threePointersAttempted" /></td>
          <td className="p-3 text-right"><Shooting stats={row.statistics} made="freeThrowsMade" attempted="freeThrowsAttempted" /></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

async function Content({ view, id, season, query }: { view: View; id?: string; season: string; query: Query }) {
  const q = { season };
  if (view === "player-stats") return await PlayerSeasonTable({ season, query });
  if (view === "standings") return await StandingsTable({ season });
  if (view === "team-stats") return await TeamStatisticsTable({ season, query });
  if (view === "dashboard") {
    const [teams, players, games, coverage] = await Promise.all([
      wnba<WnbaTeam[]>("teams", q), wnba<WnbaPlayer[]>("players", q), wnba<WnbaGame[]>("games", q), wnba<WnbaCoverage>("coverage", q),
    ]);
    const cards = [["Teams", teams.length, "teams"], ["Players", players.length, "players"], ["Schedule & Results", games.length, "schedule"]] as const;
    return <>
      <div className="grid gap-5 md:grid-cols-3">{cards.map(([title, count, path]) => <Link key={path} className={`${panel} hover:border-blue-400`} href={wnbaHref(path, season)}>
        <p className="text-slate-400">{title}</p><p className="mt-3 text-4xl font-black">{count.toLocaleString()}</p><p className="mt-4 text-blue-300">Explore →</p>
      </Link>)}</div>
      <section className={panel}><h2 className="text-2xl font-bold">Season coverage</h2>
        <div className="mt-4 grid gap-3 text-slate-300 sm:grid-cols-3">
          <p>{coverage.completedGames} completed games</p>
          <p>{coverage.completedTeamSidesWithTeamStats}/{coverage.completedTeamSides} completed team sides with statistics</p>
          <p>{coverage.completedTeamSidesWithReconciledPlayerPoints}/{coverage.completedTeamSides} completed team sides with matching player points</p>
        </div>
        <p className="mt-4 text-sm text-slate-400">Coverage reflects the imported schedule snapshot. Matching player points does not establish completeness of all statistics.</p>
        {coverage.status === "prepared_with_review_items" && <p className="mt-2 text-sm text-amber-300">This season includes source discrepancies flagged for review.</p>}
      </section>
      <section><h2 className="mb-5 text-2xl font-bold">Recent completed games</h2><Games games={games.filter(g => g.completed === true).slice(0, 6)} season={season} /></section>
      <section className="grid gap-5 md:grid-cols-2">{[["standings", "Calculated Standings", "Regular-season records, home/away results, and point differential."], ["team-stats", "Team Season Statistics", "Explore scoring, rebounding, passing, and shooting with game coverage."], ["player-stats", "Player Season Leaders", "Rank players by scoring, rebounding, assists, and shooting with adjustable sample cutoffs."]].map(([path, title, description]) =>
        <Link className={`${panel} hover:border-blue-400`} href={wnbaHref(path, season)} key={path}><h2 className="text-xl font-bold">{title}</h2><p className="mt-3 text-slate-400">{description}</p><p className="mt-5 text-blue-300">Explore →</p></Link>)}</section>
    </>;
  }
  if (view === "teams") {
    const teams = await wnba<WnbaTeam[]>("teams", q);
    return teams.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{teams.map(team => <Link key={team.id} className={`${panel} hover:border-blue-400`} href={wnbaHref(entityPath("teams", team.id), season)}>
      <p className="text-sm text-blue-300">{team.abbreviation || "WNBA"}</p><h2 className="mt-3 text-2xl font-bold">{name(team)}</h2><p className="mt-5 text-blue-300">Team profile →</p>
    </Link>)}</div> : <Empty>No teams in this imported season.</Empty>;
  }
  if (view === "players") {
    const [teams, players] = await Promise.all([wnba<WnbaTeam[]>("teams", q), wnba<WnbaPlayer[]>("players", {
      ...q, teamId: value(query, "teamId"), search: value(query, "search"),
    })]);
    const page = pageItems(players, query);
    return <><Filters query={query} season={season} teams={teams} players action={wnbaHref("players")} />
      <p className="text-slate-400">{players.length} {players.length === 1 ? "player" : "players"} · Teams reflect recorded participation; roster snapshots are labeled separately.</p>
      <Players players={page.items} teams={teams} season={season} /><Pagination {...page} query={query} path="players" season={season} /></>;
  }
  if (view === "schedule") {
    const [teams, games] = await Promise.all([wnba<WnbaTeam[]>("teams", q), wnba<WnbaGame[]>("games", {
      ...q, teamId: value(query, "teamId"), seasonType: value(query, "seasonType"),
    })]);
    const filtered = value(query, "date") ? games.filter(g => g.gameDate.slice(0, 10) === value(query, "date")) : games;
    const page = pageItems(filtered, query);
    return <><Filters query={query} season={season} teams={teams} action={wnbaHref("schedule")} />
      <p className="text-slate-400">{filtered.length} games · Latest dates first</p>
      <Games games={page.items} season={season} /><Pagination {...page} query={query} path="schedule" season={season} /></>;
  }
  if (view === "team") {
    const path = entityPath("teams", id!);
    const [team, teams, players, games] = await Promise.all([
      wnba<WnbaTeam>(path, q), wnba<WnbaTeam[]>("teams", q), wnba<WnbaPlayer[]>(`${path}/players`, q), wnba<WnbaGame[]>(`${path}/games`, q),
    ]);
    return <><section className={panel}><h2 className="text-3xl font-black">{name(team)}</h2><p className="mt-2 text-slate-400">{team.abbreviation} · {season} · {games.length} schedule games</p></section>
      {await TeamSeasonSummary({ teamId: team.id, season })}
      <section><h2 className="mb-5 text-2xl font-bold">Players</h2><Players players={players} teams={teams} season={season} /></section>
      <section><h2 className="mb-5 text-2xl font-bold">Latest games</h2><Games games={games.slice(0, 12)} season={season} />
        <Link className={`${link} mt-5 inline-block`} href={`${wnbaHref("schedule", season)}&teamId=${encodeURIComponent(team.id)}`}>View all team games →</Link></section>
      <p className="text-sm text-slate-500">Player teams use recorded participation, with roster snapshots included and labeled separately.</p></>;
  }
  if (view === "player") {
    const path = entityPath("players", id!);
    const [player, teams, logs] = await Promise.all([wnba<WnbaPlayer>(path, q), wnba<WnbaTeam[]>("teams", q), wnba<PlayerGame[]>(`${path}/games`, q)]);
    const page = pageItems(logs, query);
    return <><section className={panel}><h2 className="text-3xl font-black">{playerName(player)}</h2><p className="mt-2 text-slate-400">{player.position || "Position unavailable"} · {season}</p>
      <div className="mt-5"><p className="mb-2 text-sm text-slate-400">Recorded participation</p><TeamLinks ids={player.teamIds} teams={teams} season={season} /></div>
      <div className="mt-4"><p className="mb-2 text-sm text-slate-400">Roster snapshot</p><TeamLinks ids={player.rosterSnapshotTeamIds} teams={teams} season={season} /></div>
    </section>
      {await PlayerSeasonSummary({ playerId: player.id, name: player.fullName, season })}
      <section className={panel}><h2 className="text-2xl font-bold">Game log · {logs.length} games with player statistics</h2>
        <p className="mt-2 text-sm text-slate-400">Missing statistics appear as a dash. Games without a player statistics row are not included.</p>
        {!logs.length ? <div className="mt-5"><Empty>No game statistics available for this player in {season}.</Empty></div> : <div className="mt-5 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm"><caption className="sr-only">Player game log</caption><thead className="text-slate-400"><tr>
            <th scope="col" className="p-3">Game</th><th scope="col" className="p-3">Team</th>{columns.map(([, label]) => <th scope="col" key={label} className="p-3 text-right">{label}</th>)}
          </tr></thead><tbody>{page.items.flatMap(({ game, statistics }) => statistics.map(row => <tr key={`${game.id}-${row.teamId}`} className="border-t border-slate-800">
            <th scope="row" className="p-3"><Link className={link} href={wnbaHref(`game/${encodeURIComponent(game.id)}`, season)}>{gameDate(game.gameDate)} · {game.awayTeamName} @ {game.homeTeamName}</Link></th>
            <td className="p-3">{teams.find(t => t.id === row.teamId)?.abbreviation || "—"}</td>{columns.map(([key]) => <td className="p-3 text-right" key={key}>{statValue(row.statistics[key])}</td>)}
          </tr>))}</tbody></table></div>}
        <Pagination {...page} query={query} path={path} season={season} />
      </section></>;
  }
  const detail = await wnba<WnbaStatistics>(`${entityPath("games", id!)}/statistics`, q);
  const game = detail.game;
  return <><section className={panel}><p className="text-sm text-slate-400">{gameDate(game.gameDate)} · {game.seasonType} · {game.status}</p>
    <div className="mt-5 grid gap-5 md:grid-cols-2">{[
      { id: game.awayTeamId, name: game.awayTeamName, score: game.awayScore, label: "Away" },
      { id: game.homeTeamId, name: game.homeTeamName, score: game.homeScore, label: "Home" },
    ].map(team => <div key={team.label} className="rounded-2xl bg-slate-950 p-5"><p className="text-sm text-slate-500">{team.label}</p><Link className="mt-2 block text-xl font-bold text-blue-300 hover:underline" href={wnbaHref(entityPath("teams", team.id), season)}>{team.name || "Team"}</Link><p className="mt-3 text-5xl font-black">{statValue(team.score)}</p></div>)}</div>
    <p className="mt-5 text-sm text-slate-400">Team statistics: {detail.teamStatistics.length}/2 sides · Player statistics: {detail.playerStatistics.length} rows</p>
    <p className="mt-2 text-sm text-slate-400">Player points match team score: Home {game.coverage?.home?.playerPointsReconciled === true ? "Yes" : "Unverified"} · Away {game.coverage?.away?.playerPointsReconciled === true ? "Yes" : "Unverified"}</p>
  </section>
    <BoxScore rows={detail.teamStatistics} season={season} title="Team statistics" />
    {[game.awayTeamId, game.homeTeamId].map(teamId => <BoxScore key={teamId} player rows={detail.playerStatistics.filter(row => row.teamId === teamId)} season={season}
      title={`${teamId === game.homeTeamId ? game.homeTeamName || "Home team" : game.awayTeamName || "Away team"} · Players`} />)}
  </>;
}

export async function WnbaView({ view, id, query }: { view: View; id?: string; query: Query }) {
  // Route params can retain percent encoding during client navigation.
  // Normalize once before constructing encoded API paths.
  try { id = id ? decodeURIComponent(id) : id; }
  catch { notFound(); }
  let seasons: string[];
  let season: string;
  let content: React.ReactNode;
  try {
    seasons = (await wnba<string[]>("seasons")).sort((a, b) => Number(b) - Number(a));
    if (!seasons.length) throw new WnbaApiError(503);
    season = value(query, "season") || (seasons.includes("2024") ? "2024" : seasons[0]);
    content = seasons.includes(season) ? await Content({ view, id, season, query }) : null;
  } catch (error) {
    if (error instanceof WnbaApiError && error.status === 404) notFound();
    console.error("WNBA page request failed", error);
    return <main className="mx-auto min-h-screen max-w-6xl px-6 py-10"><section className={panel}>
      <p className="text-sm font-semibold text-blue-400">GamePulse WNBA</p><h1 className="mt-3 text-3xl font-black">WNBA data is unavailable right now</h1>
      <p className="mt-4 text-slate-400">The data service may be starting up, or this season may still need to be imported. Try again shortly.</p>
      <div className="mt-6 flex gap-5"><a className={link} href={wnbaHref("", value(query, "season"))}>Try again</a><Link className={link} href="/leagues">All leagues</Link></div>
    </section></main>;
  }
  if (!seasons.includes(season)) return <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-10">
    <Header title="Season unavailable" seasons={seasons} season={seasons[0]} />
    <Empty>The requested season has not been imported. Select an available season above.</Empty>
  </main>;
  const titles: Record<View, string> = { dashboard: "WNBA Dashboard", teams: "WNBA Teams", players: "WNBA Players", schedule: "Schedule & Results", team: "Team Profile", player: "Player Profile", game: "Game Details", standings: "WNBA Standings", "team-stats": "Team Season Statistics", "player-stats": "Player Season Leaders" };
  const route = view === "team" ? "teams" : view === "player" ? "players" : view === "game" ? "schedule" : view === "dashboard" ? "" : view;
  return <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-10">
    <Header title={titles[view]} seasons={seasons} season={season} route={route} />{content}
  </main>;
}
