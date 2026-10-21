from pathlib import Path
import json
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "raw" / "nba"
PROCESSED_DIR = BASE_DIR / "processed"

TEAM_FILE = RAW_DIR / "team.csv"
GAME_FILE = RAW_DIR / "game.csv"
LINE_SCORE_FILE = RAW_DIR / "line_score.csv"
PLAYER_FILE = RAW_DIR / "common_player_info.csv"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

def get_nba_season_type(season_id: str) -> str:
    season_id = str(season_id)

    if season_id.startswith("1"):
        return "Preseason"
    if season_id.startswith("2"):
        return "Regular Season"
    if season_id.startswith("3"):
        return "All-Star"
    if season_id.startswith("4"):
        return "Playoffs"

    return "Unknown"

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [column.strip().lower() for column in df.columns]
    return df

def safe_float(value) -> float:
    numeric_value = pd.to_numeric(value, errors="coerce")

    if pd.isna(numeric_value):
        return 0.0

    return float(numeric_value)


def save_json(data, filename: str):
    output_path = PROCESSED_DIR / filename
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)
    print(f"Saved {output_path}")


def load_teams() -> pd.DataFrame:
    teams = pd.read_csv(TEAM_FILE)
    teams = normalize_columns(teams)

    print("team.csv columns:")
    print(list(teams.columns))

    required_columns = ["id", "full_name", "abbreviation", "nickname", "city"]
    missing_columns = [column for column in required_columns if column not in teams.columns]

    if missing_columns:
        raise ValueError(f"team.csv is missing required columns: {missing_columns}")

    processed_teams = teams[required_columns].copy()

    processed_teams = processed_teams.rename(
        columns={
            "id": "externalTeamId",
            "full_name": "name",
            "abbreviation": "abbreviation",
            "nickname": "nickname",
            "city": "city",
        }
    )

    processed_teams["leagueSlug"] = "nba"

    # Basic NBA conference/division mapping.
    # This keeps the frontend filters working before we import a richer team_details table.
    conference_division_map = {
        "ATL": ("Eastern", "Southeast"),
        "BOS": ("Eastern", "Atlantic"),
        "BKN": ("Eastern", "Atlantic"),
        "CHA": ("Eastern", "Southeast"),
        "CHI": ("Eastern", "Central"),
        "CLE": ("Eastern", "Central"),
        "DAL": ("Western", "Southwest"),
        "DEN": ("Western", "Northwest"),
        "DET": ("Eastern", "Central"),
        "GSW": ("Western", "Pacific"),
        "HOU": ("Western", "Southwest"),
        "IND": ("Eastern", "Central"),
        "LAC": ("Western", "Pacific"),
        "LAL": ("Western", "Pacific"),
        "MEM": ("Western", "Southwest"),
        "MIA": ("Eastern", "Southeast"),
        "MIL": ("Eastern", "Central"),
        "MIN": ("Western", "Northwest"),
        "NOP": ("Western", "Southwest"),
        "NOH": ("Western", "Southwest"),
        "NYK": ("Eastern", "Atlantic"),
        "OKC": ("Western", "Northwest"),
        "ORL": ("Eastern", "Southeast"),
        "PHI": ("Eastern", "Atlantic"),
        "PHX": ("Western", "Pacific"),
        "POR": ("Western", "Northwest"),
        "SAC": ("Western", "Pacific"),
        "SAS": ("Western", "Southwest"),
        "TOR": ("Eastern", "Atlantic"),
        "UTA": ("Western", "Northwest"),
        "WAS": ("Eastern", "Southeast"),
    }

    processed_teams["conference"] = processed_teams["abbreviation"].map(
        lambda abbreviation: conference_division_map.get(abbreviation, ("Unknown", "Unknown"))[0]
    )

    processed_teams["division"] = processed_teams["abbreviation"].map(
        lambda abbreviation: conference_division_map.get(abbreviation, ("Unknown", "Unknown"))[1]
    )

    return processed_teams


def load_games() -> pd.DataFrame:
    games = pd.read_csv(GAME_FILE)
    games = normalize_columns(games)

    print("game.csv columns:")
    print(list(games.columns))

    return games


def detect_game_columns(games: pd.DataFrame) -> dict:
    columns = set(games.columns)

    candidates = {
        "gameId": ["game_id", "id"],
        "gameDate": ["game_date", "game_date_est", "date"],
        "season": ["season_id", "season", "season_year"],
        "homeTeamId": ["team_id_home", "home_team_id"],
        "awayTeamId": ["team_id_away", "away_team_id"],
        "homeTeamName": ["team_name_home", "home_team_name"],
        "awayTeamName": ["team_name_away", "away_team_name"],
        "homeTeamAbbreviation": ["team_abbreviation_home", "home_team_abbreviation"],
        "awayTeamAbbreviation": ["team_abbreviation_away", "away_team_abbreviation"],
        "homeScore": ["pts_home", "home_score", "points_home"],
        "awayScore": ["pts_away", "away_score", "points_away"],
        "homeWinLoss": ["wl_home", "home_wl"],
        "awayWinLoss": ["wl_away", "away_wl"],
    }

    detected = {}

    for target, possible_columns in candidates.items():
        for column in possible_columns:
            if column in columns:
                detected[target] = column
                break

    print("Detected game column mapping:")
    print(detected)

    required = [
        "gameId",
        "gameDate",
        "homeTeamId",
        "awayTeamId",
        "homeTeamName",
        "awayTeamName",
        "homeTeamAbbreviation",
        "awayTeamAbbreviation",
        "homeScore",
        "awayScore",
    ]

    missing = [column for column in required if column not in detected]

    if missing:
        raise ValueError(
            "Could not detect required game columns. "
            f"Missing mappings for: {missing}. "
            "Check the printed game.csv columns above."
        )

    return detected


def process_games(games: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    processed_games = pd.DataFrame()

    processed_games["externalGameId"] = games[mapping["gameId"]].astype(str)
    processed_games["leagueSlug"] = "nba"
    processed_games["gameDate"] = pd.to_datetime(games[mapping["gameDate"]], errors="coerce").dt.strftime(
        "%Y-%m-%d"
    )

    if "season" in mapping:
        processed_games["seasonId"] = games[mapping["season"]].astype(str)

        # NBA season IDs usually look like:
        # 12022 = preseason
        # 22022 = regular season
        # 42022 = playoffs
        processed_games["seasonType"] = processed_games["seasonId"].apply(
            get_nba_season_type
        )

        # User-facing season year, like 2022.
        processed_games["season"] = processed_games["seasonId"].str.extract(r"(\d{4})$")[0]
    else:
        processed_games["seasonId"] = ""
        processed_games["seasonType"] = "Regular Season"
        processed_games["season"] = pd.to_datetime(
            games[mapping["gameDate"]], errors="coerce"
        ).dt.year.astype(str)

    processed_games["homeExternalTeamId"] = games[mapping["homeTeamId"]]
    processed_games["awayExternalTeamId"] = games[mapping["awayTeamId"]]

    processed_games["homeTeamName"] = games[mapping["homeTeamName"]]
    processed_games["awayTeamName"] = games[mapping["awayTeamName"]]

    processed_games["homeTeamAbbreviation"] = games[mapping["homeTeamAbbreviation"]]
    processed_games["awayTeamAbbreviation"] = games[mapping["awayTeamAbbreviation"]]

    processed_games["homeScore"] = pd.to_numeric(games[mapping["homeScore"]], errors="coerce").fillna(0).astype(int)
    processed_games["awayScore"] = pd.to_numeric(games[mapping["awayScore"]], errors="coerce").fillna(0).astype(int)

    processed_games["status"] = "Final"

    processed_games = processed_games.dropna(subset=["gameDate"])

    stat_columns = [
        "fgm_home",
        "fga_home",
        "fg_pct_home",
        "fg3m_home",
        "fg3a_home",
        "fg3_pct_home",
        "ftm_home",
        "fta_home",
        "ft_pct_home",
        "oreb_home",
        "dreb_home",
        "reb_home",
        "ast_home",
        "stl_home",
        "blk_home",
        "tov_home",
        "pf_home",
        "plus_minus_home",

        "fgm_away",
        "fga_away",
        "fg_pct_away",
        "fg3m_away",
        "fg3a_away",
        "fg3_pct_away",
        "ftm_away",
        "fta_away",
        "ft_pct_away",
        "oreb_away",
        "dreb_away",
        "reb_away",
        "ast_away",
        "stl_away",
        "blk_away",
        "tov_away",
        "pf_away",
        "plus_minus_away",
    ]

    missing_stat_columns = []

    for column in stat_columns:
        if column in games.columns:
            processed_games[column] = pd.to_numeric(
                games[column],
                errors="coerce",
            ).fillna(0)
        else:
            missing_stat_columns.append(column)

    if missing_stat_columns:
        print("Missing stat columns from game.csv:")
        print(missing_stat_columns)

    return processed_games


def get_available_seasons(games: pd.DataFrame) -> list[str]:
    regular_games = games[games["seasonType"] == "Regular Season"].copy()

    seasons = (
        regular_games["season"]
        .dropna()
        .astype(str)
        .sort_values(ascending=False)
        .unique()
        .tolist()
    )

    return seasons

def calculate_standings_for_season(
    teams: pd.DataFrame,
    games: pd.DataFrame,
    season: str,
):
    season_games = games[(games["season"].astype(str) == season) & (games["seasonType"] == "Regular Season")].copy()

    print(f"Calculating standings for season: {season}")
    print(f"Games used: {len(season_games)}")

    records = {}

    for _, team in teams.iterrows():
        records[team["externalTeamId"]] = {
            "externalTeamId": int(team["externalTeamId"]),
            "leagueSlug": "nba",
            "name": team["name"],
            "abbreviation": team["abbreviation"],
            "nickname": team["nickname"],
            "city": team["city"],
            "conference": team["conference"],
            "division": team["division"],
            "wins": 0,
            "losses": 0,
            "season": season,
        }

    for _, game in season_games.iterrows():
        home_id = game["homeExternalTeamId"]
        away_id = game["awayExternalTeamId"]

        if home_id not in records or away_id not in records:
            continue

        home_score = game["homeScore"]
        away_score = game["awayScore"]

        if home_score == away_score:
            continue

        if home_score > away_score:
            records[home_id]["wins"] += 1
            records[away_id]["losses"] += 1
        else:
            records[away_id]["wins"] += 1
            records[home_id]["losses"] += 1

    standings = list(records.values())

    standings = sorted(
        standings,
        key=lambda team: (
            team["wins"] / max(team["wins"] + team["losses"], 1),
            team["wins"],
        ),
        reverse=True,
    )

    invalid_records = [team for team in standings if team["wins"] + team["losses"] > 82]

    if invalid_records:
        print("WARNING: Some teams have more than 82 games.")
        for team in invalid_records[:10]:
            print(
                f'{team["name"]}: {team["wins"]}-{team["losses"]} '
                f'({team["wins"] + team["losses"]} games)'
            )

    return standings

def safe_int(value) -> int:
    numeric_value = pd.to_numeric(value, errors="coerce")

    if pd.isna(numeric_value):
        return 0

    return int(numeric_value)

def clean_string(value) -> str:
    if pd.isna(value):
        return ""

    value = str(value).strip()

    if value.endswith(".0") and value[:-2].isdigit():
        return value[:-2]

    return value

def safe_bool(value) -> bool:
    return clean_string(value).upper() == "Y"

def clean_date(value) -> str:
    date = pd.to_datetime(value, errors="coerce")

    if pd.isna(date):
        return ""

    return date.strftime("%Y-%m-%d")

def load_line_scores() -> pd.DataFrame:
    line_scores = pd.read_csv(LINE_SCORE_FILE)
    line_scores = normalize_columns(line_scores)

    print("line_score.csv columns:")
    print(list(line_scores.columns))

    return line_scores

def load_players() -> pd.DataFrame:
    players = pd.read_csv(PLAYER_FILE)
    players = normalize_columns(players)

    print("common_player_info.csv columns:")
    print(list(players.columns))

    return players

def process_players(players: pd.DataFrame) -> list[dict]:
    required_columns = [
        "person_id",
        "first_name",
        "last_name",
        "display_first_last",
        "player_slug",
        "birthdate",
        "school",
        "country",
        "height",
        "weight",
        "season_exp",
        "jersey",
        "position",
        "rosterstatus",
        "team_id",
        "team_name",
        "team_abbreviation",
        "team_code",
        "team_city",
        "playercode",
        "from_year",
        "to_year",
        "dleague_flag",
        "nba_flag",
        "games_played_flag",
        "draft_year",
        "draft_round",
        "draft_number",
        "greatest_75_flag",
    ]

    missing_columns = [
        column for column in required_columns if column not in players.columns
    ]

    if missing_columns:
        raise ValueError(
            f"common_player_info.csv is missing expected columns: {missing_columns}. "
            "Check the printed common_player_info.csv columns above."
        )

    processed = []

    for _, player in players.iterrows():
        processed.append(
            {
                "externalPlayerId": safe_int(player["person_id"]),
                "leagueSlug": "nba",
                "firstName": clean_string(player["first_name"]),
                "lastName": clean_string(player["last_name"]),
                "fullName": clean_string(player["display_first_last"]),
                "displayLastCommaFirst": clean_string(
                    player.get("display_last_comma_first", "")
                ),
                "displayFiLast": clean_string(player.get("display_fi_last", "")),
                "slug": clean_string(player["player_slug"]),
                "birthdate": clean_date(player["birthdate"]),
                "school": clean_string(player["school"]),
                "country": clean_string(player["country"]),
                "lastAffiliation": clean_string(player.get("last_affiliation", "")),
                "height": clean_string(player["height"]),
                "weight": safe_int(player["weight"]),
                "seasonExperience": safe_int(player["season_exp"]),
                "jersey": clean_string(player["jersey"]),
                "position": clean_string(player["position"]),
                "rosterStatus": clean_string(player["rosterstatus"]),
                "gamesPlayedCurrentSeason": safe_bool(
                    player.get("games_played_current_season_flag", "")
                ),
                "externalTeamId": safe_int(player["team_id"]),
                "teamName": clean_string(player["team_name"]),
                "teamAbbreviation": clean_string(player["team_abbreviation"]),
                "teamCode": clean_string(player["team_code"]),
                "teamCity": clean_string(player["team_city"]),
                "playerCode": clean_string(player["playercode"]),
                "fromYear": safe_int(player["from_year"]),
                "toYear": safe_int(player["to_year"]),
                "dLeague": safe_bool(player["dleague_flag"]),
                "nba": safe_bool(player["nba_flag"]),
                "gamesPlayed": safe_bool(player["games_played_flag"]),
                "draftYear": clean_string(player["draft_year"]),
                "draftRound": clean_string(player["draft_round"]),
                "draftNumber": clean_string(player["draft_number"]),
                "greatest75": safe_bool(player["greatest_75_flag"]),
            }
        )

    return sorted(
        processed,
        key=lambda player: player["fullName"],
    )

def process_line_scores(line_scores: pd.DataFrame) -> list[dict]:
    columns = set(line_scores.columns)

    game_id_column = "game_id" if "game_id" in columns else "id"

    required_columns = [
        game_id_column,
        "pts_qtr1_home",
        "pts_qtr2_home",
        "pts_qtr3_home",
        "pts_qtr4_home",
        "pts_qtr1_away",
        "pts_qtr2_away",
        "pts_qtr3_away",
        "pts_qtr4_away",
    ]

    missing_columns = [
        column for column in required_columns if column not in line_scores.columns
    ]

    if missing_columns:
        raise ValueError(
            f"line_score.csv is missing expected columns: {missing_columns}. "
            "Check the printed line_score.csv columns above."
        )

    home_ot_columns = sorted(
        [
            column
            for column in line_scores.columns
            if column.startswith("pts_ot") and column.endswith("_home")
        ]
    )

    away_ot_columns = sorted(
        [
            column
            for column in line_scores.columns
            if column.startswith("pts_ot") and column.endswith("_away")
        ]
    )

    processed = []

    for _, row in line_scores.iterrows():
        game_id = str(row[game_id_column])

        item = {
            "externalGameId": game_id,
            "home": {
                "q1": safe_int(row["pts_qtr1_home"]),
                "q2": safe_int(row["pts_qtr2_home"]),
                "q3": safe_int(row["pts_qtr3_home"]),
                "q4": safe_int(row["pts_qtr4_home"]),
            },
            "away": {
                "q1": safe_int(row["pts_qtr1_away"]),
                "q2": safe_int(row["pts_qtr2_away"]),
                "q3": safe_int(row["pts_qtr3_away"]),
                "q4": safe_int(row["pts_qtr4_away"]),
            },
        }

        item["home"]["ot"] = [
            safe_int(row[column])
            for column in home_ot_columns
            if safe_int(row[column]) > 0
        ]

        item["away"]["ot"] = [
            safe_int(row[column])
            for column in away_ot_columns
            if safe_int(row[column]) > 0
        ]

        processed.append(item)

    return processed

def calculate_team_season_stats(
    teams: pd.DataFrame,
    games: pd.DataFrame,
    season: str,
) -> list[dict]:
    required_stat_columns = [
        "fgm_home", "fga_home", "fg3m_home", "fg3a_home", "ftm_home", "fta_home",
        "oreb_home", "dreb_home", "reb_home", "ast_home", "stl_home", "blk_home",
        "tov_home", "pf_home", "plus_minus_home",

        "fgm_away", "fga_away", "fg3m_away", "fg3a_away", "ftm_away", "fta_away",
        "oreb_away", "dreb_away", "reb_away", "ast_away", "stl_away", "blk_away",
        "tov_away", "pf_away", "plus_minus_away",
    ]

    missing_columns = [
        column for column in required_stat_columns if column not in games.columns
    ]

    if missing_columns:
        raise ValueError(
            "Team season stats cannot be calculated because these columns "
            f"are missing from the processed games dataframe: {missing_columns}. "
            "Fix process_games() so it preserves these columns from game.csv."
        )

    season_games = games[
        (games["season"].astype(str) == season)
        & (games["seasonType"] == "Regular Season")
    ].copy()

    team_lookup = {
        int(team["externalTeamId"]): {
            "name": team["name"],
            "abbreviation": team["abbreviation"],
            "city": team["city"],
            "conference": team["conference"],
            "division": team["division"],
        }
        for _, team in teams.iterrows()
    }

    team_stats = {}

    def ensure_team(team_id):
        team_id = int(team_id)

        if team_id not in team_stats:
            team_info = team_lookup.get(team_id, {})

            team_stats[team_id] = {
                "externalTeamId": team_id,
                "leagueSlug": "nba",
                "season": season,
                "name": team_info.get("name", ""),
                "abbreviation": team_info.get("abbreviation", ""),
                "city": team_info.get("city", ""),
                "conference": team_info.get("conference", ""),
                "division": team_info.get("division", ""),

                "games": 0,

                "points": 0.0,
                "opponentPoints": 0.0,
                "scoringMarginTotal": 0.0,

                "offensiveRebounds": 0.0,
                "defensiveRebounds": 0.0,
                "rebounds": 0.0,
                "assists": 0.0,
                "steals": 0.0,
                "blocks": 0.0,
                "turnovers": 0.0,
                "personalFouls": 0.0,

                "fieldGoalsMade": 0.0,
                "fieldGoalsAttempted": 0.0,
                "threePointersMade": 0.0,
                "threePointersAttempted": 0.0,
                "freeThrowsMade": 0.0,
                "freeThrowsAttempted": 0.0,
            }

    def add_team_game(
        team_id,
        points,
        opponent_points,
        offensive_rebounds,
        defensive_rebounds,
        rebounds,
        assists,
        steals,
        blocks,
        turnovers,
        personal_fouls,
        fgm,
        fga,
        fg3m,
        fg3a,
        ftm,
        fta,
    ):
        team_id = int(team_id)
        ensure_team(team_id)

        points = safe_float(points)
        opponent_points = safe_float(opponent_points)

        team_stats[team_id]["games"] += 1

        team_stats[team_id]["points"] += points
        team_stats[team_id]["opponentPoints"] += opponent_points
        team_stats[team_id]["scoringMarginTotal"] += points - opponent_points

        team_stats[team_id]["offensiveRebounds"] += safe_float(offensive_rebounds)
        team_stats[team_id]["defensiveRebounds"] += safe_float(defensive_rebounds)
        team_stats[team_id]["rebounds"] += safe_float(rebounds)
        team_stats[team_id]["assists"] += safe_float(assists)
        team_stats[team_id]["steals"] += safe_float(steals)
        team_stats[team_id]["blocks"] += safe_float(blocks)
        team_stats[team_id]["turnovers"] += safe_float(turnovers)
        team_stats[team_id]["personalFouls"] += safe_float(personal_fouls)

        team_stats[team_id]["fieldGoalsMade"] += safe_float(fgm)
        team_stats[team_id]["fieldGoalsAttempted"] += safe_float(fga)
        team_stats[team_id]["threePointersMade"] += safe_float(fg3m)
        team_stats[team_id]["threePointersAttempted"] += safe_float(fg3a)
        team_stats[team_id]["freeThrowsMade"] += safe_float(ftm)
        team_stats[team_id]["freeThrowsAttempted"] += safe_float(fta)

    for _, game in season_games.iterrows():
        home_id = int(game["homeExternalTeamId"])
        away_id = int(game["awayExternalTeamId"])

        add_team_game(
            team_id=home_id,
            points=game["homeScore"],
            opponent_points=game["awayScore"],
            offensive_rebounds=game["oreb_home"],
            defensive_rebounds=game["dreb_home"],
            rebounds=game["reb_home"],
            assists=game["ast_home"],
            steals=game["stl_home"],
            blocks=game["blk_home"],
            turnovers=game["tov_home"],
            personal_fouls=game["pf_home"],
            fgm=game["fgm_home"],
            fga=game["fga_home"],
            fg3m=game["fg3m_home"],
            fg3a=game["fg3a_home"],
            ftm=game["ftm_home"],
            fta=game["fta_home"],
        )

        add_team_game(
            team_id=away_id,
            points=game["awayScore"],
            opponent_points=game["homeScore"],
            offensive_rebounds=game["oreb_away"],
            defensive_rebounds=game["dreb_away"],
            rebounds=game["reb_away"],
            assists=game["ast_away"],
            steals=game["stl_away"],
            blocks=game["blk_away"],
            turnovers=game["tov_away"],
            personal_fouls=game["pf_away"],
            fgm=game["fgm_away"],
            fga=game["fga_away"],
            fg3m=game["fg3m_away"],
            fg3a=game["fg3a_away"],
            ftm=game["ftm_away"],
            fta=game["fta_away"],
        )

    results = []

    for _, stats in team_stats.items():
        games_played = max(stats["games"], 1)

        fga = stats["fieldGoalsAttempted"]
        fg3a = stats["threePointersAttempted"]
        fta = stats["freeThrowsAttempted"]

        points_per_game = stats["points"] / games_played
        opponent_points_per_game = stats["opponentPoints"] / games_played

        results.append(
            {
                **stats,

                "pointsPerGame": round(points_per_game, 1),
                "opponentPointsPerGame": round(opponent_points_per_game, 1),
                "scoringMargin": round(points_per_game - opponent_points_per_game, 1),

                "offensiveReboundsPerGame": round(
                    stats["offensiveRebounds"] / games_played,
                    1,
                ),
                "defensiveReboundsPerGame": round(
                    stats["defensiveRebounds"] / games_played,
                    1,
                ),
                "reboundsPerGame": round(stats["rebounds"] / games_played, 1),
                "assistsPerGame": round(stats["assists"] / games_played, 1),
                "stealsPerGame": round(stats["steals"] / games_played, 1),
                "blocksPerGame": round(stats["blocks"] / games_played, 1),
                "turnoversPerGame": round(stats["turnovers"] / games_played, 1),
                "personalFoulsPerGame": round(
                    stats["personalFouls"] / games_played,
                    1,
                ),

                "fieldGoalPercentage": round(
                    stats["fieldGoalsMade"] / fga if fga > 0 else 0,
                    3,
                ),
                "threePointPercentage": round(
                    stats["threePointersMade"] / fg3a if fg3a > 0 else 0,
                    3,
                ),
                "freeThrowPercentage": round(
                    stats["freeThrowsMade"] / fta if fta > 0 else 0,
                    3,
                ),
            }
        )

    invalid_game_counts = [
        team for team in results if team["games"] > 82
    ]

    if invalid_game_counts:
        print(f"WARNING: Some teams have more than 82 games in {season}.")
        for team in invalid_game_counts[:10]:
            print(f'{team["name"]}: {team["games"]} games')

    return sorted(
        results,
        key=lambda team: team["pointsPerGame"],
        reverse=True,
    )


def calculate_team_stats_by_season(
    teams: pd.DataFrame,
    games: pd.DataFrame,
    seasons: list[str],
) -> dict:
    team_stats_by_season = {}

    for season in seasons:
        print(f"Calculating team stats for season: {season}")

        stats = calculate_team_season_stats(
            teams=teams,
            games=games,
            season=season,
        )

        team_stats_by_season[season] = stats

    return team_stats_by_season




def main():

    print("Preparing NBA data...")

    teams = load_teams()
    raw_games = load_games()
    raw_line_scores = load_line_scores()
    raw_players = load_players()
    mapping = detect_game_columns(raw_games)
    games = process_games(raw_games, mapping)
    line_scores = process_line_scores(raw_line_scores)
    players = process_players(raw_players)
    # season_averages = calculate_season_averages(games, season="2022")

    seasons = get_available_seasons(games)

    print("Available seasons:")
    print(seasons[:10])
    print(f"Total seasons found: {len(seasons)}")

    standings_by_season = {}

    for season in seasons:
        standings_by_season[season] = calculate_standings_for_season(
            teams,
            games,
            season,
        )

    team_stats_by_season = calculate_team_stats_by_season(
    teams,
    games,
    seasons,
)

    teams_json = teams.to_dict(orient="records")
    games_json = games.to_dict(orient="records")

    save_json(teams_json, "teams.json")
    save_json(games_json, "games.json")
    save_json(seasons, "seasons.json")
    save_json(standings_by_season, "standings_by_season.json")
    save_json(line_scores, "line_scores.json")
    save_json(players, "players.json")
    save_json(team_stats_by_season, "team_stats_by_season.json")

    print("Done.")
if __name__ == "__main__":
    main()
