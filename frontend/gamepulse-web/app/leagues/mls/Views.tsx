import Link from "next/link";
import { getMlsSeason, mlsStandings, type MlsGame, type MlsSeason, type MlsStat } from "@/lib/mls";

export type Query = Record<string, string | string[] | undefined>;
const value = (query: Query, key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
const sections = [ ["", "Overview"], ["teams", "Teams"], ["players", "Players"], ["schedule", "Schedule"], ["standings", "Standings"], ["team-stats", "Team Stats"], ["player-stats", "Player Stats"], ["compare", "Compare"], ["analytics", "Analytics"] ];
const panel = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6";
const input = "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white";
function Empty({ subject = "MLS" }: { subject?: string }) { return <div className={panel} role="status"><h2 className="text-xl font-bold">Data unavailable</h2><p className="mt-2 text-slate-400">{subject} data is unavailable for this season. Check back when coverage is available.</p></div>; }
function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-800"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr>{headers.map(h => <th key={h} scope="col" className="px-5 py-4">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-slate-800">{row.map((cell, j) => <td key={j} className="px-5 py-4">{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>;
}
function Stats({ rows, names }: { rows: MlsStat[]; names: Map<string, React.ReactNode> }) {
  if (!rows.length) return <Empty subject="Statistics" />;
  const keys = [...new Set(rows.flatMap(row => Object.keys(row.statistics)))];
  if (!keys.length) return <Empty subject="Statistics" />;
  return <Table headers={["Name", ...keys.map(key => key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()))]} rows={rows.map(row => [names.get(row.id) ?? row.id, ...keys.map(key => row.statistics[key] == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(row.statistics[key]!))])} />;
}
function Games({ games, data, href }: { games: MlsGame[]; data: MlsSeason; href: (path: string) => string }) {
  const name = (id: string) => data.teams.find(t => t.id === id)?.name ?? id;
  if (!games.length) return <Empty subject="Schedule" />;
  return <Table headers={["Date", "Match", "Score", "Status"]} rows={[...games].sort((a,b) => a.date.localeCompare(b.date)).map(g => [g.date, <Link key={g.id} className="text-blue-300" href={href(`game/${encodeURIComponent(g.id)}`)}>{name(g.awayTeamId)} at {name(g.homeTeamId)}</Link>, g.homeScore == null || g.awayScore == null ? "—" : `${g.awayScore} – ${g.homeScore}`, g.status || (g.completed ? "Final" : "Scheduled")])} />;
}
export async function MlsView({ view, query, id }: { view: string; query: Query; id?: string }) {
  const season = value(query, "season");
  const { seasons, data } = await getMlsSeason(season);
  const selected = season ?? data?.season.toString();
  const href = (path: string) => `/leagues/mls${path ? `/${path}` : ""}${selected ? `?season=${encodeURIComponent(selected)}` : ""}`;
  const teamLinks = new Map(data?.teams.map(t => [t.id, <Link key={t.id} className="text-blue-300" href={href(`teams/${encodeURIComponent(t.id)}`)}>{t.name}</Link>]));
  const playerLinks = new Map(data?.players.map(p => [p.id, <Link key={p.id} className="text-blue-300" href={href(`players/${encodeURIComponent(p.id)}`)}>{p.name}</Link>]));
  const title = sections.find(s => s[0] === view)?.[1] ?? (view === "team" ? "Team Profile" : view === "player" ? "Player Profile" : "Match Details");
  let content: React.ReactNode = <Empty />;
  if (data) {
    const standings = mlsStandings(data);
    const teamStats = data.teamStats.filter(s => !s.seasonType || s.seasonType === "Regular Season");
    const playerStats = data.playerStats.filter(s => !s.seasonType || s.seasonType === "Regular Season");
    if (view === "") content = <><div className="grid gap-4 sm:grid-cols-3">{[["Teams", data.teams.length], ["Players", data.players.length], ["Matches", data.games.length]].map(([label, count]) => <div key={label} className={panel}><p className="text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{count}</p></div>)}</div><h2 className="text-xl font-bold">Season schedule</h2><Games games={data.games.slice(0, 10)} data={data} href={href} /></>;
    if (view === "teams") content = data.teams.length ? <Table headers={["Team", "Conference", "Venue"]} rows={data.teams.map(t => [teamLinks.get(t.id), t.conference, t.venue])} /> : <Empty subject="Teams" />;
    if (view === "players") content = data.players.length ? <Table headers={["Player", "Team", "Position"]} rows={data.players.map(p => [playerLinks.get(p.id), teamLinks.get(p.teamId ?? ""), p.position])} /> : <Empty subject="Players" />;
    if (view === "schedule") content = <Games games={data.games} data={data} href={href} />;
    if (view === "standings" || view === "analytics") content = !standings.some(s => s.played) ? <Empty subject={title} /> : <><p className="text-sm text-slate-400">Calculated from completed regular-season matches with available scores. Shootout matches are excluded because regulation scores are unavailable. Wins earn 3 points; draws earn 1. Sorted by points, goal difference, then goals scored. Official MLS tiebreakers and playoff seeding are not applied.</p><Table headers={["Team", "Conference", "Played", "W", "D", "L", "GF", "GA", "GD", "Points", ...(view === "analytics" ? ["Goals / match", "Points / match"] : [])]} rows={standings.map(s => [teamLinks.get(s.team.id), s.team.conference, s.played, s.wins, s.draws, s.losses, s.goalsFor, s.goalsAgainst, s.goalDifference, s.points, ...(view === "analytics" ? [s.played ? (s.goalsFor / s.played).toFixed(2) : "—", s.played ? (s.points / s.played).toFixed(2) : "—"] : [])])} /></>;
    if (view === "team-stats") content = <Stats rows={teamStats} names={teamLinks} />;
    if (view === "player-stats") content = <Stats rows={playerStats} names={playerLinks} />;
    if (view === "team") {
      const team = data.teams.find(t => t.id === id);
      content = team ? <><div className={panel}><h2 className="text-2xl font-bold">{team.name}</h2><p className="mt-2 text-slate-400">{[team.conference, team.venue].filter(Boolean).join(" · ")}</p></div><Stats rows={teamStats.filter(s => s.id === id)} names={teamLinks} /><h2 className="text-xl font-bold">Roster</h2>{data.players.some(p => p.teamId === id) ? <Table headers={["Player", "Position"]} rows={data.players.filter(p => p.teamId === id).map(p => [playerLinks.get(p.id), p.position])} /> : <Empty subject="Roster" />}<h2 className="text-xl font-bold">Matches</h2><Games games={data.games.filter(g => g.homeTeamId === id || g.awayTeamId === id)} data={data} href={href} /></> : <Empty subject="Team" />;
    }
    if (view === "player") {
      const player = data.players.find(p => p.id === id);
      content = player ? <><div className={panel}><h2 className="text-2xl font-bold">{player.name}</h2><p className="mt-2 text-slate-400">{player.position} {teamLinks.get(player.teamId ?? "")}</p></div><Stats rows={playerStats.filter(s => s.id === id)} names={playerLinks} /></> : <Empty subject="Player" />;
    }
    if (view === "game") content = <Games games={data.games.filter(g => g.id === id)} data={data} href={href} />;
    if (view === "compare") {
      const kind = value(query, "kind") === "players" ? "players" : "teams";
      const entities = kind === "teams" ? data.teams : data.players;
      const left = value(query, "left"), right = value(query, "right");
      const rows = (kind === "teams" ? teamStats : playerStats).filter(s => s.id === left || s.id === right);
      content = <><form className={`${panel} flex flex-wrap items-end gap-4`}><input type="hidden" name="season" value={selected ?? ""} /><label className="grid gap-2">Compare<select name="kind" defaultValue={kind} className={input}><option value="teams">Teams</option><option value="players">Players</option></select></label>{["left", "right"].map(key => <label key={key} className="grid gap-2">{key === "left" ? "First" : "Second"}<select name={key} defaultValue={value(query, key) ?? ""} className={input}><option value="">Select an entry</option>{entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>)}<button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold">Compare</button></form><p className="text-sm text-slate-400">Choose Teams or Players and submit to load that list, then select two entries.</p>{left && right && left !== right ? <Stats rows={rows} names={kind === "teams" ? teamLinks : playerLinks} /> : <p className="text-slate-400">Select two different entries to compare their season statistics.</p>}</>;
    }
  }
  return <main className="mx-auto max-w-6xl space-y-6 px-6 py-10"><div><Link href="/leagues" className="text-sm text-blue-300">← All leagues</Link><p className="mt-6 text-sm font-semibold uppercase tracking-widest text-blue-400">Major League Soccer</p><h1 className="mt-2 text-4xl font-black">MLS {title}</h1><p className="mt-3 text-slate-400">Explore teams, players, match results, and season performance.</p></div><nav aria-label="MLS sections" className="flex flex-wrap gap-2">{sections.map(([path, label]) => <Link key={path} href={href(path)} aria-current={path === view ? "page" : undefined} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-blue-400 aria-[current=page]:border-blue-400 aria-[current=page]:text-blue-300">{label}</Link>)}</nav>{seasons.length > 0 && <form className="flex items-end gap-3"><label className="grid gap-2 text-sm">Season<select name="season" defaultValue={selected} className={input}>{season && !seasons.includes(Number(season)) && <option value={season}>{season} (unavailable)</option>}{seasons.map(s => <option key={s} value={s}>{s}</option>)}</select></label><button className="rounded-lg bg-blue-600 px-4 py-2">Apply</button></form>}{content}</main>;
}
