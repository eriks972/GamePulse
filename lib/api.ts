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

export type TeamStats = {
  id: number;
  externalTeamId?: number;
  leagueSlug: string;
  season: string;
  name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
  games: number;
  points: number;
  opponentPoints: number;
  scoringMarginTotal: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  personalFouls: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  pointsPerGame: number;
  opponentPointsPerGame: number;
  scoringMargin: number;
  offensiveReboundsPerGame: number;
  defensiveReboundsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  turnoversPerGame: number;
  personalFoulsPerGame: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
};

export type Player = {
  id: number;
  externalPlayerId?: number;
  leagueSlug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayLastCommaFirst: string;
  displayFiLast: string;
  slug: string;
  birthdate: string;
  school: string;
  country: string;
  lastAffiliation: string;
  height: string;
  weight: number;
  seasonExperience: number;
  jersey: string;
  position: string;
  rosterStatus: string;
  gamesPlayedCurrentSeason: boolean;
  externalTeamId: number;
  teamName: string;
  teamAbbreviation: string;
  teamCode: string;
  teamCity: string;
  playerCode: string;
  fromYear: number;
  toYear: number;
  dLeague: boolean;
  nba: boolean;
  gamesPlayed: boolean;
  draftYear: string;
  draftRound: string;
  draftNumber: string;
  greatest75: boolean;
};

export type Game = {
  id?: string;
  externalGameId?: string;
  leagueSlug: string;
  season: string;
  gameDate: string;
  seasonType?: string;

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

function normalizeTeamStats(teamStats: TeamStats): TeamStats {
  return {
    ...teamStats,
    id: teamStats.id ?? teamStats.externalTeamId,
  };
}

function normalizePlayer(player: Player): Player {
  return {
    ...player,
    id: player.id ?? player.externalPlayerId,
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

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  delayMs = 1200,
): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok || response.status < 500) {
        return response;
      }

      lastResponse = response;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return lastResponse as Response;
}

export async function getNbaPlayers(teamId?: string): Promise<Player[]> {
  const url = teamId
    ? `${API_BASE_URL}/api/leagues/nba/players?teamId=${teamId}`
    : `${API_BASE_URL}/api/leagues/nba/players`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA players");
  }

  const players = await response.json();

  return players.map(normalizePlayer);
}

export async function getNbaPlayerById(id: string): Promise<Player | null> {
  const response = await fetch(`${API_BASE_URL}/api/leagues/nba/players/${id}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch NBA player");
  }

  const player = await response.json();

  return normalizePlayer(player);
}

export async function getNbaTeamStats(season?: string): Promise<TeamStats[]> {
  const url = season
    ? `${API_BASE_URL}/api/leagues/nba/team-stats?season=${season}`
    : `${API_BASE_URL}/api/leagues/nba/team-stats`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch NBA team stats");
  }

  const teamStats = await response.json();

  return teamStats.map(normalizeTeamStats);
}

export async function getNbaTeamStatsByTeamId(
  teamId: string,
  season?: string,
): Promise<TeamStats | null> {
  const url = season
    ? `${API_BASE_URL}/api/leagues/nba/team-stats/${teamId}?season=${season}`
    : `${API_BASE_URL}/api/leagues/nba/team-stats/${teamId}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch NBA team stats");
  }

  const teamStats = await response.json();

  return normalizeTeamStats(teamStats);
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

export async function getNbaGames(season = "2022"): Promise<Game[]> {
  const selectedSeason = season || "2022";

  const url = `${API_BASE_URL}/api/leagues/nba/games?season=${selectedSeason}`;

  const response = await fetchWithRetry(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Failed to fetch NBA games", {
      url,
      status: response.status,
      statusText: response.statusText,
      errorText,
    });

    throw new Error(
      `Failed to fetch NBA games: ${response.status} ${response.statusText} ${errorText}`,
    );
  }

  return response.json();
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

export type LineScoreBreakdown = {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  ot: number[];
};

export type LineScore = {
  gameId: string;
  externalGameId: string;
  leagueSlug: string;
  season: string;
  teamExternalId: number;
  teamId: number;
  teamName: string;
  teamAbbreviation: string;
  isHome: boolean;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  ot1: number;
  ot2: number;
  otAll: number;
  total: number;
};

export async function getNbaGameById(id: string): Promise<Game> {
  const url = `${API_BASE_URL}/api/leagues/nba/games/${id}`;

  console.log("Fetching NBA game:", url);

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Failed to fetch NBA game", {
      url,
      status: response.status,
      statusText: response.statusText,
      errorText,
    });

    throw new Error(
      `Failed to fetch NBA game: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const game = await response.json();

  return normalizeGame(game);
}

export async function getNbaLineScoreByGameId(id: string): Promise<LineScore[]> {
  const url = `${API_BASE_URL}/api/leagues/nba/line-scores/${id}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Failed to fetch NBA line score", {
      url,
      status: response.status,
      statusText: response.statusText,
      errorText,
    });

    return [];
  }

  return response.json();
}