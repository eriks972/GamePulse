"""Read-only MLS HTTP checks. Run against a backend containing an imported season."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("GAMEPULSE_API_BASE_URL", "http://localhost:5241").rstrip("/") + "/api/leagues/mls"
checks = 0


def get(path, expected=200):
    global checks
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as response:
            status, data = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, data = error.code, json.load(error)
    assert status == expected, (path, status, expected, data)
    checks += 1
    return data


seasons = get("/seasons")
assert seasons, "Import at least one MLS season before running these HTTP checks"
for season in seasons:
    envelope = get("/season?season=" + season)
    assert envelope["data"]["season"] == int(season)
    coverage = get("/coverage?season=" + season)
    assert coverage["teams"] == len(envelope["data"]["teams"])

season = seasons[0]
query = "season=" + season
teams = get("/teams?" + query)
players = get("/players?" + query + "&pageSize=1")
games = get("/games?" + query + "&pageSize=1")
get("/standings?" + query)
get("/analytics?" + query)
get("/statistics?" + query + "&kind=team&pageSize=1")
get("/statistics?" + query + "&kind=player&pageSize=1")
get("/statistics?" + query + "&kind=player&search=nonexistent-name-mls-check")
if teams:
    team_id = urllib.parse.quote(teams[0]["id"], safe="")
    get("/teams/" + team_id + "?" + query)
    get("/players?" + query + "&teamId=" + team_id)
    get("/games?" + query + "&teamId=" + team_id)
    get("/compare?kind=team&leftId=" + team_id + "&rightId=" + team_id + "&leftSeason=" + season + "&rightSeason=" + season)
if players["items"]:
    player_id = urllib.parse.quote(players["items"][0]["id"], safe="")
    get("/players/" + player_id + "?" + query)
    get("/players/" + player_id + "/games?" + query)
    get("/compare?leftId=" + player_id + "&rightId=" + player_id + "&leftSeason=" + season + "&rightSeason=" + season)
if games["items"]:
    game = games["items"][0]
    game_id = urllib.parse.quote(game["id"], safe="")
    get("/games/" + game_id + "?" + query)
    get("/games/" + game_id + "/statistics?" + query)
    filtered = get("/games?" + query + "&date=" + game["date"])
    assert filtered["total"] > 0
for path in ["/players?" + query + "&page=0", "/games?" + query + "&pageSize=101", "/games?date=bad", "/games?status=bad", "/statistics?kind=bad", "/analytics?seasonType=bad", "/season?season=12", "/season?season=abc"]:
    get(path, 400)
for path in ["/teams/missing?", "/players/missing?", "/games/missing?"]:
    get(path + query, 404)
print(f"{checks} MLS HTTP checks passed")
