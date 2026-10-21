import json
from pathlib import Path

import pandas as pd 


BASE_DIR = Path(__file__).resolve().parents[1]

RAW_DIR = BASE_DIR  / "raw" / "eoin_nba"
OUTPUT_DIR = BASE_DIR / "processed" / "eoin_nba"

GAMES_FILE = RAW_DIR / "Games.csv"
TEAM_STATS_FILE = RAW_DIR / "TeamStatistics.csv"

GAMES_BY_SEASON_DIR = OUTPUT_DIR / "games_by_season"
TEAM_STATS_BY_SEASON_DIR = OUTPUT_DIR / "team_stats_by_season"
STANDINGS_BY_SEASON_DIR = OUTPUT_DIR / "standings_by_season"
LINE_SCORES_BY_SEASON_DIR = OUTPUT_DIR / "line_scores_by_season"


TEAM_ABBREVIATIONS = {
    1610612737: "ATL",
    1610612738: "BOS",
    1610612751: "BKN",
    1610612766: "CHA",
    1610612741: "CHI",
    1610612739: "CLE",
    1610612742: "DAL",
    1610612743: "DEN",
    1610612765: "DET",
    1610612744: "GSW",
    1610612745: "HOU",
    1610612754: "IND",
    1610612746: "LAC",
    1610612747: "LAL",
    1610612763: "MEM",
    1610612748: "MIA",
    1610612749: "MIL",
    1610612750: "MIN",
    1610612740: "NOP",
    1610612752: "NYK",
    1610612760: "OKC",
    1610612753: "ORL",
    1610612755: "PHI",
    1610612756: "PHX",
    1610612757: "POR",
    1610612758: "SAC",
    1610612759: "SAS",
    1610612761: "TOR",
    1610612762: "UTA",
    1610612764: "WAS",
}

TEAM_METADATA = {
    1610612737: {
        "name": "Atlanta Hawks",
        "abbreviation": "ATL",
        "nickname": "Hawks",
        "city": "Atlanta",
        "conference": "Eastern",
        "division": "Southeast",
    },
    1610612738: {
        "name": "Boston Celtics",
        "abbreviation": "BOS",
        "nickname": "Celtics",
        "city": "Boston",
        "conference": "Eastern",
        "division": "Atlantic",
    },
    1610612751: {
        "name": "Brooklyn Nets",
        "abbreviation": "BKN",
        "nickname": "Nets",
        "city": "Brooklyn",
        "conference": "Eastern",
        "division": "Atlantic",
    },
    1610612766: {
        "name": "Charlotte Hornets",
        "abbreviation": "CHA",
        "nickname": "Hornets",
        "city": "Charlotte",
        "conference": "Eastern",
        "division": "Southeast",
    },
    1610612741: {
        "name": "Chicago Bulls",
        "abbreviation": "CHI",
        "nickname": "Bulls",
        "city": "Chicago",
        "conference": "Eastern",
        "division": "Central",
    },
    1610612739: {
        "name": "Cleveland Cavaliers",
        "abbreviation": "CLE",
        "nickname": "Cavaliers",
        "city": "Cleveland",
        "conference": "Eastern",
        "division": "Central",
    },
    1610612742: {
        "name": "Dallas Mavericks",
        "abbreviation": "DAL",
        "nickname": "Mavericks",
        "city": "Dallas",
        "conference": "Western",
        "division": "Southwest",
    },
    1610612743: {
        "name": "Denver Nuggets",
        "abbreviation": "DEN",
        "nickname": "Nuggets",
        "city": "Denver",
        "conference": "Western",
        "division": "Northwest",
    },
    1610612765: {
        "name": "Detroit Pistons",
        "abbreviation": "DET",
        "nickname": "Pistons",
        "city": "Detroit",
        "conference": "Eastern",
        "division": "Central",
    },
    1610612744: {
        "name": "Golden State Warriors",
        "abbreviation": "GSW",
        "nickname": "Warriors",
        "city": "Golden State",
        "conference": "Western",
        "division": "Pacific",
    },
    1610612745: {
        "name": "Houston Rockets",
        "abbreviation": "HOU",
        "nickname": "Rockets",
        "city": "Houston",
        "conference": "Western",
        "division": "Southwest",
    },
    1610612754: {
        "name": "Indiana Pacers",
        "abbreviation": "IND",
        "nickname": "Pacers",
        "city": "Indiana",
        "conference": "Eastern",
        "division": "Central",
    },
    1610612746: {
        "name": "LA Clippers",
        "abbreviation": "LAC",
        "nickname": "Clippers",
        "city": "LA",
        "conference": "Western",
        "division": "Pacific",
    },
    1610612747: {
        "name": "Los Angeles Lakers",
        "abbreviation": "LAL",
        "nickname": "Lakers",
        "city": "Los Angeles",
        "conference": "Western",
        "division": "Pacific",
    },
    1610612763: {
        "name": "Memphis Grizzlies",
        "abbreviation": "MEM",
        "nickname": "Grizzlies",
        "city": "Memphis",
        "conference": "Western",
        "division": "Southwest",
    },
    1610612748: {
        "name": "Miami Heat",
        "abbreviation": "MIA",
        "nickname": "Heat",
        "city": "Miami",
        "conference": "Eastern",
        "division": "Southeast",
    },
    1610612749: {
        "name": "Milwaukee Bucks",
        "abbreviation": "MIL",
        "nickname": "Bucks",
        "city": "Milwaukee",
        "conference": "Eastern",
        "division": "Central",
    },
    1610612750: {
        "name": "Minnesota Timberwolves",
        "abbreviation": "MIN",
        "nickname": "Timberwolves",
        "city": "Minnesota",
        "conference": "Western",
        "division": "Northwest",
    },
    1610612740: {
        "name": "New Orleans Pelicans",
        "abbreviation": "NOP",
        "nickname": "Pelicans",
        "city": "New Orleans",
        "conference": "Western",
        "division": "Southwest",
    },
    1610612752: {
        "name": "New York Knicks",
        "abbreviation": "NYK",
        "nickname": "Knicks",
        "city": "New York",
        "conference": "Eastern",
        "division": "Atlantic",
    },
    1610612760: {
        "name": "Oklahoma City Thunder",
        "abbreviation": "OKC",
        "nickname": "Thunder",
        "city": "Oklahoma City",
        "conference": "Western",
        "division": "Northwest",
    },
    1610612753: {
        "name": "Orlando Magic",
        "abbreviation": "ORL",
        "nickname": "Magic",
        "city": "Orlando",
        "conference": "Eastern",
        "division": "Southeast",
    },
    1610612755: {
        "name": "Philadelphia 76ers",
        "abbreviation": "PHI",
        "nickname": "76ers",
        "city": "Philadelphia",
        "conference": "Eastern",
        "division": "Atlantic",
    },
    1610612756: {
        "name": "Phoenix Suns",
        "abbreviation": "PHX",
        "nickname": "Suns",
        "city": "Phoenix",
        "conference": "Western",
        "division": "Pacific",
    },
    1610612757: {
        "name": "Portland Trail Blazers",
        "abbreviation": "POR",
        "nickname": "Trail Blazers",
        "city": "Portland",
        "conference": "Western",
        "division": "Northwest",
    },
    1610612758: {
        "name": "Sacramento Kings",
        "abbreviation": "SAC",
        "nickname": "Kings",
        "city": "Sacramento",
        "conference": "Western",
        "division": "Pacific",
    },
    1610612759: {
        "name": "San Antonio Spurs",
        "abbreviation": "SAS",
        "nickname": "Spurs",
        "city": "San Antonio",
        "conference": "Western",
        "division": "Southwest",
    },
    1610612761: {
        "name": "Toronto Raptors",
        "abbreviation": "TOR",
        "nickname": "Raptors",
        "city": "Toronto",
        "conference": "Eastern",
        "division": "Atlantic",
    },
    1610612762: {
        "name": "Utah Jazz",
        "abbreviation": "UTA",
        "nickname": "Jazz",
        "city": "Utah",
        "conference": "Western",
        "division": "Northwest",
    },
    1610612764: {
        "name": "Washington Wizards",
        "abbreviation": "WAS",
        "nickname": "Wizards",
        "city": "Washington",
        "conference": "Eastern",
        "division": "Southeast",
    },
}


def get_abbreviation(team_id):
    team_id = safe_int(team_id)

    if team_id is None:
        return ""

    return TEAM_ABBREVIATIONS.get(team_id, "")

def clean_value(value):
    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        return value.item()

    return value


def safe_int(value):
    if pd.isna(value):
        return None

    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def safe_float(value):
    if pd.isna(value):
        return None

    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def get_season_from_date(date_value):
    """
    GamePulse season convention:
    2024 = 2024-25 season
    2025 = 2025-26 season
    """
    date = pd.to_datetime(date_value, errors="coerce")

    if pd.isna(date):
        return None

    year = date.year
    month = date.month

    if month >= 10:
        return str(year)

    return str(year - 1)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

    print(f"Wrote {path}")


def build_games_by_season():
    print("Reading Games.csv...")

    games_df = pd.read_csv(GAMES_FILE)
    games_df["season"] = games_df["gameDateTimeEst"].apply(get_season_from_date)

    games_df = games_df[games_df["season"].notna()]

    for season, season_games_df in games_df.groupby("season"):
        games = []

        for _, row in season_games_df.iterrows():
            game_type = clean_value(row.get("gameType"))

            game = {
                "id": str(row.get("gameId")),
                "externalGameId": str(row.get("gameId")),
                "leagueSlug": "nba",
                "season": str(season),
                "seasonType": game_type or "Regular Season",
                "gameDate": clean_value(row.get("gameDate")),
                "gameDateTimeEst": clean_value(row.get("gameDateTimeEst")),
                "homeTeamId": str(row.get("hometeamId")),
                "awayTeamId": str(row.get("awayteamId")),
                "homeTeamCity": clean_value(row.get("hometeamCity")),
                "homeTeamName": clean_value(row.get("hometeamName")),
                "awayTeamCity": clean_value(row.get("awayteamCity")),
                "awayTeamName": clean_value(row.get("awayteamName")),
                "homeScore": safe_int(row.get("homeScore")),
                "awayScore": safe_int(row.get("awayScore")),
                "winner": clean_value(row.get("winner")),
                "gameType": game_type,
                "gameSubtype": clean_value(row.get("gameSubtype")),
                "gameLabel": clean_value(row.get("gameLabel")),
                "gameSubLabel": clean_value(row.get("gameSubLabel")),
                "seriesGameNumber": clean_value(row.get("seriesGameNumber")),
                "attendance": safe_int(row.get("attendance")),
                "arenaId": clean_value(row.get("arenaId")),
                "arenaName": clean_value(row.get("arenaName")),
                "arenaCity": clean_value(row.get("arenaCity")),
                "arenaState": clean_value(row.get("arenaState")),
                "officials": clean_value(row.get("officials")),
            }

            games.append(game)

        games.sort(key=lambda game: game.get("gameDateTimeEst") or "", reverse=True)

        output_path = GAMES_BY_SEASON_DIR / f"{season}.json"
        write_json(output_path, games)


def build_team_stats_by_season():
    print("Building regular season team stats from TeamStatistics.csv...")

    stats_df = pd.read_csv(TEAM_STATS_FILE)

    stats_df["season"] = stats_df["gameDateTimeEst"].apply(get_season_from_date)
    stats_df = stats_df[stats_df["season"].notna()]

    # Only regular season games
    stats_df = stats_df[stats_df.apply(is_regular_season_game, axis=1)]

    # Clean IDs and prevent duplicate team/game rows
    stats_df["teamIdClean"] = stats_df["teamId"].apply(safe_int)
    stats_df["gameIdClean"] = stats_df["gameId"].astype(str)

    stats_df = stats_df.drop_duplicates(
        subset=["season", "teamIdClean", "gameIdClean"]
    )

    combined_team_stats_by_season = {}

    for season, season_stats_df in stats_df.groupby("season"):
        season_team_stats = []

        for team_id, team_df in season_stats_df.groupby("teamIdClean"):
            if team_id is None or team_id not in TEAM_METADATA:
                continue

            meta = TEAM_METADATA[team_id]

            games = len(team_df)

            if games == 0:
                continue

            points = float(team_df["teamScore"].fillna(0).sum())
            opponent_points = float(team_df["opponentScore"].fillna(0).sum())

            offensive_rebounds = float(team_df["reboundsOffensive"].fillna(0).sum())
            defensive_rebounds = float(team_df["reboundsDefensive"].fillna(0).sum())
            rebounds = float(team_df["reboundsTotal"].fillna(0).sum())

            assists = float(team_df["assists"].fillna(0).sum())
            steals = float(team_df["steals"].fillna(0).sum())
            blocks = float(team_df["blocks"].fillna(0).sum())
            turnovers = float(team_df["turnovers"].fillna(0).sum())
            personal_fouls = float(team_df["foulsPersonal"].fillna(0).sum())

            field_goals_made = float(team_df["fieldGoalsMade"].fillna(0).sum())
            field_goals_attempted = float(team_df["fieldGoalsAttempted"].fillna(0).sum())

            three_pointers_made = float(team_df["threePointersMade"].fillna(0).sum())
            three_pointers_attempted = float(
                team_df["threePointersAttempted"].fillna(0).sum()
            )

            free_throws_made = float(team_df["freeThrowsMade"].fillna(0).sum())
            free_throws_attempted = float(team_df["freeThrowsAttempted"].fillna(0).sum())

            scoring_margin_total = points - opponent_points

            def per_game(value):
                return round(value / games, 1) if games else 0

            def percentage(made, attempted):
                return round(made / attempted, 3) if attempted else 0

            team_stat = {
                "externalTeamId": int(team_id),
                "leagueSlug": "nba",
                "season": str(season),
                "name": meta["name"],
                "abbreviation": meta["abbreviation"],
                "city": meta["city"],
                "conference": meta["conference"],
                "division": meta["division"],

                "games": int(games),

                "points": points,
                "opponentPoints": opponent_points,
                "scoringMarginTotal": scoring_margin_total,

                "offensiveRebounds": offensive_rebounds,
                "defensiveRebounds": defensive_rebounds,
                "rebounds": rebounds,

                "assists": assists,
                "steals": steals,
                "blocks": blocks,
                "turnovers": turnovers,
                "personalFouls": personal_fouls,

                "fieldGoalsMade": field_goals_made,
                "fieldGoalsAttempted": field_goals_attempted,
                "threePointersMade": three_pointers_made,
                "threePointersAttempted": three_pointers_attempted,
                "freeThrowsMade": free_throws_made,
                "freeThrowsAttempted": free_throws_attempted,

                "pointsPerGame": per_game(points),
                "opponentPointsPerGame": per_game(opponent_points),
                "scoringMargin": per_game(scoring_margin_total),

                "offensiveReboundsPerGame": per_game(offensive_rebounds),
                "defensiveReboundsPerGame": per_game(defensive_rebounds),
                "reboundsPerGame": per_game(rebounds),

                "assistsPerGame": per_game(assists),
                "stealsPerGame": per_game(steals),
                "blocksPerGame": per_game(blocks),
                "turnoversPerGame": per_game(turnovers),
                "personalFoulsPerGame": per_game(personal_fouls),

                "fieldGoalPercentage": percentage(
                    field_goals_made,
                    field_goals_attempted,
                ),
                "threePointPercentage": percentage(
                    three_pointers_made,
                    three_pointers_attempted,
                ),
                "freeThrowPercentage": percentage(
                    free_throws_made,
                    free_throws_attempted,
                ),
            }

            season_team_stats.append(team_stat)

        season_team_stats.sort(
            key=lambda team: team["pointsPerGame"],
            reverse=True,
        )

        output_path = TEAM_STATS_BY_SEASON_DIR / f"{season}.json"
        write_json(output_path, season_team_stats)

        combined_team_stats_by_season[str(season)] = season_team_stats

        print(f"\nTeam stats season {season}")
        print(f"Teams: {len(season_team_stats)}")

        for team in season_team_stats[:5]:
            print(
                f'{team["abbreviation"]}: '
                f'{team["games"]} games, '
                f'{team["pointsPerGame"]} PPG, '
                f'{team["opponentPointsPerGame"]} Opp PPG'
            )

    combined_output_path = OUTPUT_DIR / "team_stats_by_season.json"
    write_json(combined_output_path, combined_team_stats_by_season)
    
def is_regular_season_game(row):
    game_type = str(row.get("gameType", "")).strip().lower()
    game_id = str(row.get("gameId", "")).strip()

    # Eoin dataset has gameType, but this extra gameId check protects us from
    # preseason, all-star, and playoff games.
    return game_type == "regular season" and game_id.startswith("2")


def build_standings_by_season():
    print("Building regular season standings from TeamStatistics.csv...")

    stats_df = pd.read_csv(TEAM_STATS_FILE)

    stats_df["season"] = stats_df["gameDateTimeEst"].apply(get_season_from_date)
    stats_df = stats_df[stats_df["season"].notna()]

    stats_df = stats_df[stats_df.apply(is_regular_season_game, axis=1)]

    # Prevent accidental duplicate team/game rows from inflating records.
    stats_df["teamIdClean"] = stats_df["teamId"].apply(safe_int)
    stats_df["gameIdClean"] = stats_df["gameId"].astype(str)

    stats_df = stats_df.drop_duplicates(
        subset=["season", "teamIdClean", "gameIdClean"]
    )

    combined_standings_by_season = {}

    for season, season_stats_df in stats_df.groupby("season"):
        standings = {}

        for _, row in season_stats_df.iterrows():
            team_id = safe_int(row.get("teamId"))

            if team_id is None:
                continue

            if team_id not in TEAM_METADATA:
                continue

            meta = TEAM_METADATA[team_id]

            if team_id not in standings:
                standings[team_id] = {
                    "externalTeamId": team_id,
                    "leagueSlug": "nba",
                    "name": meta["name"],
                    "abbreviation": meta["abbreviation"],
                    "nickname": meta["nickname"],
                    "city": meta["city"],
                    "conference": meta["conference"],
                    "division": meta["division"],
                    "wins": 0,
                    "losses": 0,
                    "season": str(season),
                }

            win_value = row.get("win")

            if isinstance(win_value, str):
                is_win = win_value.strip().lower() in ["true", "1", "yes", "win", "w"]
            else:
                is_win = bool(win_value)

            if is_win:
                standings[team_id]["wins"] += 1
            else:
                standings[team_id]["losses"] += 1

        standings_list = list(standings.values())

        standings_list.sort(
            key=lambda team: (
                team["wins"] / max(team["wins"] + team["losses"], 1),
                team["wins"],
            ),
            reverse=True,
        )

        output_path = STANDINGS_BY_SEASON_DIR / f"{season}.json"
        write_json(output_path, standings_list)

        combined_standings_by_season[str(season)] = standings_list

        print(f"\nSeason {season}")
        for team in standings_list[:5]:
            games = team["wins"] + team["losses"]
            print(
                f'{team["abbreviation"]}: {team["wins"]}-{team["losses"]} '
                f"({games} games)"
            )

    combined_output_path = OUTPUT_DIR / "standings_by_season.json"
    write_json(combined_output_path, combined_standings_by_season)

def build_line_scores_by_season():
    print("Building line scores from TeamStatistics.csv...")

    stats_df = pd.read_csv(TEAM_STATS_FILE)
    stats_df["season"] = stats_df["gameDateTimeEst"].apply(get_season_from_date)
    stats_df = stats_df[stats_df["season"].notna()]

    for season, season_stats_df in stats_df.groupby("season"):
        line_scores = []

        for _, row in season_stats_df.iterrows():
            team_id = safe_int(row.get("teamId")) or 0

            line_score = {
                "gameId": str(row.get("gameId")),
                "externalGameId": str(row.get("gameId")),
                "leagueSlug": "nba",
                "season": str(season),
                "teamExternalId": team_id,
                "teamId": team_id,
                "teamName": clean_value(row.get("teamName")),
                "teamAbbreviation": get_abbreviation(row.get("teamId")),
                "isHome": bool(row.get("home")) if not pd.isna(row.get("home")) else False,
                "q1": safe_int(row.get("q1Points")) or 0,
                "q2": safe_int(row.get("q2Points")) or 0,
                "q3": safe_int(row.get("q3Points")) or 0,
                "q4": safe_int(row.get("q4Points")) or 0,
                "ot1": safe_int(row.get("ot1Points")) or 0,
                "ot2": safe_int(row.get("ot2Points")) or 0,
                "otAll": safe_int(row.get("otAllPoints")) or 0,
                "total": safe_int(row.get("teamScore")) or 0,
            }

            line_scores.append(line_score)

        line_scores.sort(
            key=lambda score: (score.get("gameId") or "", not score.get("isHome"))
        )

        output_path = LINE_SCORES_BY_SEASON_DIR / f"{season}.json"
        write_json(output_path, line_scores)

def main():
    if not GAMES_FILE.exists():
        raise FileNotFoundError(f"Missing file: {GAMES_FILE}")

    if not TEAM_STATS_FILE.exists():
        raise FileNotFoundError(f"Missing file: {TEAM_STATS_FILE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    build_games_by_season()
    build_team_stats_by_season()
    build_standings_by_season()
    build_line_scores_by_season()

    print("\nDone.")
    print(f"Processed files saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()