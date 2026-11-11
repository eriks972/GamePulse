export type MlsTeam = { id: string; name: string; abbreviation?: string | null; conference?: string | null; venue?: string | null };
export type MlsPlayer = { id: string; name: string; teamId?: string | null; position?: string | null };
export type MlsGame = { id: string; date: string; homeTeamId: string; awayTeamId: string; seasonType: string; status?: string | null; completed: boolean; shootout?: boolean; shootoutWinnerTeamId?: string | null; shootoutWinPoints?: number | null; startTime?: string | null; homeScore: number | null; awayScore: number | null };
export type MlsStat = { id: string; seasonType?: string; statistics: Record<string, number | null> };
export type MlsSeason = { season: number; teams: MlsTeam[]; players: MlsPlayer[]; games: MlsGame[]; teamStats: MlsStat[]; playerStats: MlsStat[] };
export type MlsResponse = { seasons: number[]; data: MlsSeason | null; message?: string };
export async function getMlsSeason(season?: string): Promise<MlsResponse> {
  try {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241").replace(/\/$/, "");
    const query = season ? `?season=${encodeURIComponent(season)}` : "";
    const response = await fetch(`${base}/api/leagues/mls/season${query}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`MLS request failed: ${response.status}`);
    const result: MlsResponse = await response.json();
    if (!Array.isArray(result.seasons) || (result.data && ![result.data.teams, result.data.players, result.data.games, result.data.teamStats, result.data.playerStats].every(Array.isArray))) throw new Error("Invalid MLS response");
    return result;
  } catch {
    return { seasons: [], data: null, message: "MLS data is unavailable. Please try again later." };
  }
}
export function mlsStandings(data: MlsSeason) {
  return data.teams.map(team => {
    let played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, points = 0;
    for (const game of data.games) {
      const resolvedShootout = data.season >= 1996 && data.season <= 1999 && game.shootout && game.shootoutWinPoints === 1 &&
        game.homeScore != null && game.homeScore === game.awayScore &&
        (game.shootoutWinnerTeamId === game.homeTeamId || game.shootoutWinnerTeamId === game.awayTeamId);
      if (!game.completed || (game.shootout && !resolvedShootout) || game.seasonType !== "Regular Season" || game.homeScore == null || game.awayScore == null) continue;
      const home = game.homeTeamId === team.id;
      if (!home && game.awayTeamId !== team.id) continue;
      const scored = home ? game.homeScore : game.awayScore;
      const conceded = home ? game.awayScore : game.homeScore;
      played++; goalsFor += scored; goalsAgainst += conceded;
      if (resolvedShootout) {
        if (game.shootoutWinnerTeamId === team.id) { wins++; points++; } else losses++;
      } else if (scored > conceded) { wins++; points += 3; }
      else if (scored === conceded) { draws++; points++; } else losses++;
    }
    return { team, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst, points };
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name));
}

