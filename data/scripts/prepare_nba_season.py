import json
from pathlib import Path
from collections import defaultdict

source_path = Path("/Users/erik/gamepulse/backend/GamePulse.Api/Data/processed/games.json")
output_dir = Path("/Users/erik/gamepulse/backend/GamePulse.Api/Data/processed/games_by_season")

output_dir.mkdir(parents=True, exist_ok=True)

with source_path.open("r", encoding="utf-8") as f:
    games = json.load(f)

games_by_season = defaultdict(list)

for game in games:
    season = str(game.get("season", "")).strip()
    if not season:
        continue

    games_by_season[season].append(game)

for season, season_games in games_by_season.items():
    output_path = output_dir / f"{season}.json"

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(season_games, f, ensure_ascii=False)

    print(f"Wrote {len(season_games)} games to {output_path}")