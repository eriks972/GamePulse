const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5241";

export type Team = {
  id: number;
  leagueSlug: string;
  name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
};

export type Game = {
  id: number;
  leagueSlug: string;
  season: string;
  gameDate: string;

  homeTeamId: number;
  homeTeamName: string;
  homeTeamAbbreviation: string;
  homeScore: number;

  awayTeamId: number;
  awayTeamName: string;
  awayTeamAbbreviation: string;
  awayScore: number;

  status: string;
};

export async function getNbaTeams(): Promise<Team[]> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/teams`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA teams");
  }

  return response.json();
}

export async function getNbaTeamById(id: string): Promise<Team> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/teams/${id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA team");
  }

  return response.json();
}

export async function getNbaGames(): Promise<Game[]> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/games`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA games");
  }

  return response.json();
}