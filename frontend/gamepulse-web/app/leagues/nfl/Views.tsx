import Link from "next/link";
import { notFound } from "next/navigation";
import { Filters } from "./Filters";
import { Leaderboards } from "./Leaderboards";
import { SourceStats } from "./SourceStats";
import {
  nfl, nflHref, nflEntity, NflApiError, display, dateLabel, phaseName, statGroups,
  type NflSeason, type NflReport, type NflTeam, type NflPlayer, type NflGame, type NflPage,
  type NflStat, type NflStandings, type NflTeamDetail, type NflPlayerDetail, type NflGameDetail,
} from "@/lib/nfl";

export type Query = Record<string, string | string[] | undefined>;
export type View = "leaderboards" | "dashboard" | "teams" | "players" | "schedule" | "standings" | "team" | "player" | "game" | "player-stats" | "team-stats";
const panel = "rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-6";
const link = "font-semibold text-blue-300 hover:text-blue-200 hover:underline";
const input = "max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
const values = (q: Query) => Object.fromEntries(Object.entries(q).filter(([, v]) => typeof v === "string")) as Record<string, string>;
const titles: Record<View, string> = { leaderboards: "NFL Season Leaderboards", dashboard: "NFL Dashboard", teams: "NFL Teams", players: "NFL Players", schedule: "NFL Schedule & Results", standings: "NFL Team Records", team: "NFL Team Profile", player: "NFL Player Profile", game: "NFL Game Details", "player-stats": "NFL Weekly Player Stats", "team-stats": "NFL Weekly Team Stats" };
function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-2xl bg-slate-950 p-5 text-slate-400">{children}</p>; }
function Header({ view, seasons, season, route, group }: { view: View; seasons: NflSeason[]; season: string; route: string; group?: string }) {
  return <section className={`${panel} bg-linear-to-br from-slate-900 to-blue-950/40`}>
    <Link className={link} href="/leagues">← All leagues</Link>
    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">GamePulse NFL · {season}</p>
    <h1 className="mt-3 text-4xl font-black md:text-5xl">{titles[view]}</h1>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
      <nav aria-label="NFL sections" className="flex flex-wrap gap-4">{[["", "Overview"], ["leaderboards", "Leaders"], ["teams", "Teams"], ["players", "Players"], ["schedule", "Schedule & Results"], ["standings", "Team Records"], ["team-stats", "Team Stats"], ["player-stats", "Player Stats"]].map(([p, label]) => <Link key={p} className={link} aria-current={route === p ? "page" : undefined} href={nflHref(p, { season })}>{label}</Link>)}</nav>
      <form key={season} action={nflHref(route)} className="flex flex-wrap items-center gap-3">
        {view === "leaderboards" && <input type="hidden" name="group" value={group || "passing"} />}
        <label htmlFor="nfl-season" className="text-sm text-slate-300">Season</label>
        <select id="nfl-season" name="season" className={input} defaultValue={season}>{seasons.map(s => <option key={s.season} value={s.season}>{s.season}</option>)}</select>
        <button className="rounded-xl bg-blue-500 px-4 py-2 font-bold hover:bg-blue-400">Load season</button>
      </form>
    </div>
  </section>;
}
function Pager({ data, path, query }: { data: NflPage<unknown>; path: string; query: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <nav aria-label="Results pagination" className="mt-5 flex flex-wrap items-center gap-5 text-sm">
    <p className="text-slate-400">{data.total.toLocaleString()} results · Page {data.page} of {pages}</p>
    {data.page > 1 && <Link className={link} href={nflHref(path, { ...query, page: String(data.page - 1) })}>← Previous</Link>}
    {data.page < pages && <Link className={link} href={nflHref(path, { ...query, page: String(data.page + 1) })}>Next →</Link>}
  </nav>;
}
function TeamLink({ id, season, teams }: { id: string; season: string; teams: NflTeam[] }) {
  return <Link className={link} href={nflHref(nflEntity("teams", id), { season })}>{teams.find(t => t.teamId === id)?.name || id}</Link>;
}
function GameCards({ games, teams, season }: { games: NflGame[]; teams: NflTeam[]; season: string }) {
  if (!games.length) return <Empty>No games match this selection.</Empty>;
  return <div className="grid gap-4 md:grid-cols-2">{games.map(g => <Link key={g.gameId} href={nflHref(nflEntity("game", g.gameId), { season })} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-400">
    <p className="text-xs text-slate-400">{dateLabel(g.date)} · {phaseName(g.seasonType)} · {g.round === "REG" || g.round === "PRE" ? `Week ${g.week}` : `${g.round} · source week ${g.week}`}</p>
    <div className="mt-4 space-y-3">{[[g.awayTeamId, g.awayScore], [g.homeTeamId, g.homeScore]].map(([id, score], i) => <div className="flex items-start justify-between gap-4" key={String(id)}><p className="font-bold">{teams.find(t => t.teamId === id)?.name || id}<span className="ml-2 text-xs font-normal text-slate-500">{i ? "HOME" : "AWAY"}</span></p><p className="text-xl font-black tabular-nums">{display(score)}</p></div>)}</div>
    <p className="mt-4 text-xs text-blue-300">{g.status === "final" ? "Final · batch snapshot" : "No final score in snapshot"}{g.kickoffUtc ? ` · ${dateLabel(g.kickoffUtc, true)}` : ""}</p>
  </Link>)}</div>;
}
function PlayerCards({ players, season }: { players: NflPlayer[]; season: string }) {
  if (!players.length) return <Empty>No players match this selection.</Empty>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{players.map(p => <Link className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-5 hover:border-blue-400" key={p.playerId} href={nflHref(nflEntity("players", p.playerId), { season })}><h2 className="text-lg font-bold">{p.name}</h2><p className="mt-3 text-sm text-slate-400">{p.position || "Position unavailable"} · {p.teamIds.join(" / ") || "Team unavailable"}</p></Link>)}</div>;
}
function GroupTabs({ path, query, group }: { path: string; query: Record<string, string>; group: string }) {
  return <nav aria-label="Statistic category" className="flex flex-wrap gap-3">{Object.entries(statGroups).map(([key, g]) => <a key={key} className={`rounded-full border px-4 py-2 text-sm font-bold ${group === key ? "border-blue-400 bg-blue-500/10 text-blue-300" : "border-slate-700 text-slate-300 hover:border-blue-400"}`} aria-current={group === key ? "page" : undefined} href={nflHref(path, { ...query, page: "1", statGroup: key })}>{g.label}</a>)}</nav>;
}
function StatsTable({ rows, group, season, teams, label, activityOnly = false }: { rows: NflStat[]; group: string; season: string; teams: NflTeam[]; label: string; activityOnly?: boolean }) {
  const cols = statGroups[group].columns;
  const selected = activityOnly ? rows.filter(r => cols.some(([k]) => typeof r.stats[k] === "number" && r.stats[k] !== 0)) : rows;
  return <section className={panel}><h2 className="text-2xl font-bold">{label} · {statGroups[group].label}</h2><p className="mt-3 text-sm leading-6 text-slate-400">Weekly observations, with regular season and postseason labeled separately. A dash means unavailable; zero is preserved. {activityOnly && "Shows rows with recorded activity in this category."}</p>
    {!selected.length ? <div className="mt-5"><Empty>No recorded {activityOnly ? "activity in this category" : "statistics for this selection"}.</Empty></div> : <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label={`${label} ${statGroups[group].label}, scroll horizontally`}>
      <table className="w-full text-sm"><thead className="text-slate-400"><tr>{["Player / Team", "Type / Week", "Game", "Opponent", ...cols.map(([, label]) => label)].map((label, i) => <th key={label} scope="col" className={`whitespace-nowrap p-3 ${i < 4 ? "text-left" : "text-right"}`}>{label}</th>)}</tr></thead><tbody>{selected.map((r, i) => <tr key={`${r.gameId}-${r.teamId}-${r.playerId || "team"}-${i}`} className="border-t border-slate-800">
        <th scope="row" className="min-w-40 p-3 text-left">{r.playerId ? <Link className={link} href={nflHref(nflEntity("players", r.playerId), { season })}>{r.name || r.playerId}</Link> : <TeamLink id={r.teamId} season={season} teams={teams} />}<p className="mt-1 text-xs font-normal text-slate-500">{r.playerId ? `${r.position || ""} · ${r.teamId}` : r.teamId}</p></th>
        <td className="whitespace-nowrap p-3 text-slate-300">{r.seasonType} · {r.week}</td><td className="p-3"><Link className={link} href={nflHref(nflEntity("game", r.gameId), { season })}>Details</Link></td><td className="p-3"><TeamLink id={r.opponentTeamId} season={season} teams={teams} /></td>{cols.map(([key]) => <td className="p-3 text-right tabular-nums" key={key}>{display(r.stats[key])}</td>)}
      </tr>)}</tbody></table>
    </div>}
  </section>;
}

async function Content({ view, season, query, id, report, teams }: { view: View; season: string; query: Record<string, string>; id?: string; report: NflReport; teams: NflTeam[] }) {
  const q: Record<string, string> = { ...query, season };
  const group = Object.hasOwn(statGroups, query.statGroup || "") ? query.statGroup : "passing";
  if (view === "leaderboards") return await Leaderboards({ season, query: q, teams });
  if (view === "dashboard") {
    const finals = await nfl<NflPage<NflGame>>("games", { season, status: "final", pageSize: "6", order: "desc" });
    return <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Scheduled games", report.coverage.games], ["Scored games", report.coverage.completedGames], ["Teams", report.coverage.teams], ["Player identities", report.coverage.players]].map(([label, value]) => <div className={panel} key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-black">{display(value)}</p></div>)}</section>
      <section className={panel}><h2 className="text-2xl font-bold">Explore the season</h2><p className="mt-3 leading-7 text-slate-400">Browse the schedule, follow teams and players, and inspect weekly passing, rushing, receiving, defense, and kicking statistics.</p><div className="mt-5 flex flex-wrap gap-4">{[["leaderboards", "Season Leaderboards"], ["schedule", "Schedule & Results"], ["standings", "Team Records"], ["player-stats", "Weekly Player Stats"]].map(([path, label]) => <Link key={path} className={link} href={nflHref(path, { season })}>{label} →</Link>)}</div></section>
      <section className={panel}><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-bold">Latest scored games</h2><Link className={link} href={nflHref("schedule", { season })}>Full schedule →</Link></div><GameCards games={finals.items} season={season} teams={teams} /></section></>;
  }
  if (view === "teams") {
    const d = await nfl<NflStandings>("standings", { season });
    return <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{d.teams.map(({ team, record }) => <Link className={`${panel} hover:border-blue-400`} key={team.teamId} href={nflHref(nflEntity("teams", team.teamId), { season })}><p className="text-sm font-bold text-blue-400">{team.teamId}</p><h2 className="mt-3 text-2xl font-black">{team.name}</h2><p className="mt-3 text-sm text-slate-400">{team.division || team.conference || "Division unavailable"}</p><p className="mt-4 font-semibold">Regular season: {record ? `${record.wins}–${record.losses}–${record.ties}` : "No scored games"}</p></Link>)}</section>;
  }
  if (view === "players" || view === "schedule") {
    const filter = <Filters key={JSON.stringify(q)} season={season} path={view} teams={teams} report={report} query={q} players={view === "players"} />;
    if (view === "players") {
      const d = await nfl<NflPage<NflPlayer>>("players", { season, search: q.search, teamId: q.teamId, position: q.position, page: q.page });
      return <>{filter}<section className={panel}><p className="mb-5 text-sm leading-6 text-slate-400">Season identities include roster associations. A roster listing alone does not prove a game appearance or current team membership.</p><PlayerCards players={d.items} season={season} /><Pager data={d} path={view} query={q} /></section></>;
    }
    const d = await nfl<NflPage<NflGame>>("games", { season, seasonType: q.seasonType, week: q.week, teamId: q.teamId, status: q.status, page: q.page });
    return <>{filter}<section className={panel}><GameCards games={d.items} teams={teams} season={season} /><Pager data={d} path={view} query={q} /></section></>;
  }
  if (view === "standings") {
    const d = await nfl<NflStandings>("standings", { season, seasonType: q.seasonType || "REG" });
    const divisions = [...new Set(d.teams.map(r => r.team.division || "Division unavailable"))];
    return <><Filters key={JSON.stringify(q)} season={season} path="standings" teams={teams} report={report} query={q} standings /><section className={panel}><h2 className="text-2xl font-bold">{phaseName(d.seasonType)} records</h2><p className="mt-3 text-sm leading-6 text-slate-400">{d.method}</p></section>{divisions.map(division => <section key={division} className={panel}><h2 className="text-xl font-bold">{division}</h2><div className="mt-5 overflow-x-auto" role="region" tabIndex={0} aria-label={`${division} records, scroll horizontally`}><table className="w-full text-sm"><thead className="text-slate-400"><tr>{["Team", "GP", "W", "L", "T", "PCT", "PF", "PA", "Diff"].map((x, i) => <th className={`whitespace-nowrap p-3 ${i ? "text-right" : "text-left"}`} key={x} scope="col">{x}</th>)}</tr></thead><tbody>{d.teams.filter(r => (r.team.division || "Division unavailable") === division).map(r => <tr className="border-t border-slate-800" key={r.team.teamId}><th className="min-w-48 p-3 text-left" scope="row"><TeamLink id={r.team.teamId} season={season} teams={teams} /></th>{[r.record?.played, r.record?.wins, r.record?.losses, r.record?.ties, r.winPercentage?.toFixed(3), r.record?.pointsFor, r.record?.pointsAgainst, r.record ? r.record.pointsFor - r.record.pointsAgainst : null].map((v, i) => <td key={i} className="p-3 text-right tabular-nums">{display(v)}</td>)}</tr>)}</tbody></table></div></section>)}</>;
  }
  if (view === "team" && id) {
    const d = await nfl<NflTeamDetail>(`teams/${encodeURIComponent(id)}`, { season });
    const path = nflEntity("teams", id);
    return <><section className={panel}><p className="text-sm font-bold text-blue-400">{d.team.teamId} · {d.team.division}</p><h2 className="mt-3 text-3xl font-black">{d.team.name}</h2><div className="mt-5 flex flex-wrap gap-5">{d.records.map(r => <p key={r.seasonType} className="rounded-xl bg-slate-950 p-4"><span className="text-sm text-slate-400">{phaseName(r.seasonType)}</span><strong className="mt-2 block text-xl">{r.wins}–{r.losses}–{r.ties}</strong><span className="mt-2 block text-xs text-slate-500">{r.played} scored games · PF {r.pointsFor} / PA {r.pointsAgainst}</span></p>)}</div></section>
      <GroupTabs path={path} query={q} group={group} /><StatsTable rows={d.statistics} group={group} season={season} teams={teams} label="Team weekly statistics" />
      <section className={panel}><h2 className="mb-5 text-2xl font-bold">Season roster associations</h2><p className="mb-5 text-sm text-slate-400">Annual source associations, including roster-only identities and source status codes; this is not a current active roster.</p>{!d.rosters.length ? <Empty>No roster associations available.</Empty> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{d.rosters.map((r, i) => <div className="min-w-0 rounded-xl bg-slate-950 p-4" key={`${r.playerId}-${i}`}>{r.playerId ? <Link className={link} href={nflHref(nflEntity("players", r.playerId), { season })}>{r.name || r.playerId}</Link> : <p className="font-semibold">{r.name || "Identity unavailable"}</p>}<p className="mt-2 text-xs text-slate-400">{r.position || "—"} · #{display(r.jerseyNumber)} · {r.status || "Status unavailable"}</p></div>)}</div>}</section>
      <section className={panel}><h2 className="mb-5 text-2xl font-bold">Team schedule</h2><GameCards games={d.games} teams={teams} season={season} /></section></>;
  }
  if (view === "player" && id) {
    const d = await nfl<NflPlayerDetail>(`players/${encodeURIComponent(id)}`, { season });
    const path = nflEntity("players", id);
    return <><section className={panel}><p className="text-sm text-blue-400">{d.player.position || "Position unavailable"}</p><h2 className="mt-3 text-3xl font-black">{d.player.name}</h2><p className="mt-4 text-sm text-slate-400">{new Set(d.statistics.map(r => r.gameId)).size} games with observed statistics · GSIS {d.player.playerId}</p><div className="mt-5 flex flex-wrap gap-4">{d.player.teamIds.map(t => <TeamLink key={t} id={t} season={season} teams={teams} />)}</div><p className="mt-4 text-xs leading-6 text-slate-500">Season team associations are retained across trades. Weekly rows identify the contributing team; roster membership alone is not a game appearance.</p></section>
      <GroupTabs path={path} query={q} group={group} /><StatsTable rows={d.statistics} group={group} season={season} teams={teams} label="Player weekly statistics" />
      <section className={panel}><h2 className="mb-5 text-2xl font-bold">Games with observed player statistics</h2><GameCards games={d.games} teams={teams} season={season} /></section></>;
  }
  if (view === "game" && id) {
    const d = await nfl<NflGameDetail>(`games/${encodeURIComponent(id)}`, { season }); const g = d.game;
    return <><section className={panel}><p className="text-sm text-slate-400">{dateLabel(g.date)} · {phaseName(g.seasonType)} · {g.round} · source week {g.week}</p><h2 className="mt-4 text-2xl font-black"><TeamLink id={g.awayTeamId} season={season} teams={teams} /> {display(g.awayScore)} <span className="text-slate-500">at</span> <TeamLink id={g.homeTeamId} season={season} teams={teams} /> {display(g.homeScore)}</h2><p className="mt-4 text-sm text-slate-400">{g.stadium || "Stadium unavailable"} · {g.kickoffUtc ? dateLabel(g.kickoffUtc, true) : "Kickoff time unavailable"}</p><p className="mt-3 text-sm text-blue-300">{g.status === "final" ? "Final · batch snapshot" : "No final score in this snapshot"}</p>{!d.teamStatistics.length && <p className="mt-4 text-sm text-amber-300">Team statistics are unavailable for this game.</p>}</section>
      <GroupTabs path={nflEntity("game", id)} query={q} group={group} />
      <StatsTable rows={d.teamStatistics} group={group} season={season} teams={teams} label="Team statistics" />
      {[g.awayTeamId, g.homeTeamId].map(t => <StatsTable key={t} rows={d.playerStatistics.filter(r => r.teamId === t)} group={group} season={season} teams={teams} label={`${teams.find(team => team.teamId === t)?.name || t} players`} activityOnly />)}
      <SourceStats key={id} rows={[...d.teamStatistics, ...d.playerStatistics]} /></>;
  }
  if (view === "player-stats" || view === "team-stats") {
    const d = await nfl<NflPage<NflStat>>("statistics", { season, kind: view === "player-stats" ? "player" : "team", seasonType: q.seasonType, week: q.week, teamId: q.teamId, search: q.search, page: q.page, statGroup: group });
    return <><Filters key={JSON.stringify(q)} season={season} path={view} teams={teams} report={report} query={{ ...q, statGroup: group }} statistics /><GroupTabs path={view} query={q} group={group} /><p className="text-sm text-slate-400">Weekly game logs with recorded activity in the selected category. These are observations, without season rankings or combined rate statistics.</p><StatsTable rows={d.items} group={group} season={season} teams={teams} label={view === "player-stats" ? "Weekly player statistics" : "Weekly team statistics"} /><Pager data={d} path={view} query={q} /></>;
  }
  return <Empty>This NFL view is unavailable.</Empty>;
}

export async function NflView({ view, query, id }: { view: View; query: Query; id?: string }) {
  if (id) { try { id = decodeURIComponent(id); } catch { notFound(); } }
  const q = values(query);
  const route = view === "dashboard" ? "" : view === "team" ? "teams" : view === "player" ? "players" : view === "game" ? "schedule" : view;
  let seasons: NflSeason[] = []; let season = q.season || ""; let report: NflReport | undefined; let content: React.ReactNode; let failure: unknown;
  try {
    seasons = await nfl<NflSeason[]>("seasons");
    season = season || String(seasons[0]?.season || "");
    if (seasons.some(s => String(s.season) === season)) {
      const [r, teams] = await Promise.all([nfl<NflReport>("coverage", { season }), nfl<NflTeam[]>("teams", { season })]);
      report = r; content = await Content({ view, season, query: q, id, report, teams });
    }
  } catch (e) { failure = e; }
  if (failure instanceof NflApiError && failure.status === 404 && id) notFound();
  const header = seasons.length > 0 ? <Header view={view} seasons={seasons} season={seasons.some(s => String(s.season) === season) ? season : String(seasons[0].season)} route={route} group={q.group} /> : null;
  if (failure) return <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-4 py-10 md:px-6">{header}<section className={panel}><h1 className="text-2xl font-bold">{failure instanceof NflApiError && failure.status === 400 ? "Check the selected filters" : "NFL data is unavailable right now"}</h1><p className="mt-3 leading-6 text-slate-400">{failure instanceof NflApiError && failure.status === 400 ? "Choose a valid season type, source week, and page, or reset this view." : "The NFL service could not load this view. Try again shortly."}</p><div className="mt-5 flex flex-wrap gap-5"><a className={link} href={nflHref(route, { season })}>Reset this view</a><a className={link} href={nflHref(id ? nflEntity(view === "team" ? "teams" : view === "player" ? "players" : "game", id) : route, { ...q, season })}>Try again</a><Link className={link} href="/leagues">All leagues</Link></div></section></main>;
  return <main className="mx-auto min-h-screen max-w-6xl space-y-7 px-4 py-10 md:px-6">{header}{!seasons.length ? <section className={panel}><h1 className="text-3xl font-black">NFL data has not been published yet</h1><p className="mt-4 text-slate-400">Import a validated NFL snapshot into the backend to make it available here.</p><Link className={`${link} mt-5 inline-block`} href="/leagues">← All leagues</Link></section> : !report ? <Empty>This season is unavailable. Select one of the imported seasons above.</Empty> : <><aside className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 text-sm leading-6 text-slate-300"><p className="font-semibold text-blue-300">Historical / batch data · Updated {dateLabel(report.generatedAtUtc, true)}</p><p className="mt-2">{report.method}</p><details className="mt-2"><summary className="cursor-pointer text-blue-300">Coverage details</summary><p className="mt-2">{report.coverage.completedGames} scored games · {report.coverage.teamStats} team rows · {report.coverage.playerStats} player rows · {report.coverage.missingCompletedTeamGames} missing completed team-games · {report.coverage.unassignedPlayerStatRows} player rows without IDs excluded from player views · {report.coverage.unassignedTeamStatRows || 0} unassigned team fragments excluded · {report.coverage.resolvedPlayerTeamRows || 0} player team identities resolved from source evidence.</p><p className="mt-2">Playoffs retain their NFL season even when played in January or February. Weeks follow source numbering; POST is distinct from REG. Missing player values remain unavailable.</p></details></aside>{content}</>}</main>;
}
