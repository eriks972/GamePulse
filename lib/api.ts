const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241";

export type Team = {
  id: number;
  externalTeamId?: number;
  leagueSlug: string;
  name: string;
  abbreviation: string;
  nickname?: string;
  city: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  season?: string;
};

export type Game = {
  id?: string;
  externalGameId?: string;
  leagueSlug: string;
  season: string;
  gameDate: string;

  homeExternalTeamId: number;
  awayExternalTeamId: number;

  homeTeamName: string;
  homeTeamAbbreviation: string;
  homeScore: number;

  awayTeamName: string;
  awayTeamAbbreviation: string;
  awayScore: number;

  status: string;
};

export function getGameId(game: Game): string {
  return game.id ?? game.externalGameId ?? `${game.gameDate}-${game.awayTeamAbbreviation}-${game.homeTeamAbbreviation}`;
}

function normalizeGame(game: Game): Game {
  return {
    ...game,
    id: getGameId(game),
  };
}

function normalizeTeam(team: Team): Team {
  return {
    ...team,
    id: team.id ?? team.externalTeamId,
  };
}

export async function getNbaTeams(): Promise<Team[]> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/teams`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA teams");
  }

  const teams = await response.json();

  return teams.map(normalizeTeam);
}

export async function getNbaTeamById(id: string): Promise<Team> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/teams/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA team");
  }

  const team = await response.json();

  return normalizeTeam(team);
}

export async function getNbaGames(season?: string): Promise<Game[]> {
  const url = season
    ? `${API_BASE_URL}/api/leagues/nba/games?season=${season}`
    : `${API_BASE_URL}/api/leagues/nba/games`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA games");
  }

  const games = await response.json();

  return games.map(normalizeGame);
}

export async function getNbaSeasons(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/seasons`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA seasons");
  }

  return response.json();
}

export async function getNbaStandings(season?: string): Promise<Team[]> {
  const url = season
    ? `${API_BASE_URL}/api/leagues/nba/standings?season=${season}`
    : `${API_BASE_URL}/api/leagues/nba/standings`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA standings");
  }

  const teams = await response.json();

  return teams.map(normalizeTeam);
}

export function getTeamId(team: Team): number {
  return team.id ?? team.externalTeamId ?? 0;
}