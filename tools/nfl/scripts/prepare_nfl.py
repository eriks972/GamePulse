#!/usr/bin/env python3
"""GamePulse NFL ingestion. Python 3.10+; only third-party dependency: pyarrow.

Uses the nflverse release assets documented by SportsDataverse. The weekly
player release preserves defensive/kicking fields absent from legacy loaders.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import shutil
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

RELEASE = "https://github.com/nflverse/nflverse-data/releases/download"
TEAM_URL = "https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/teams_colors_logos.csv"
DATASETS = ("schedule", "teams", "rosters", "player_stats", "team_stats")
ALIASES = {"JAC": "JAX", "LA": "LAR", "STL": "LAR", "SD": "LAC", "OAK": "LV"}
POST = {"POST", "WC", "DIV", "CON", "SB"}


def now():
    return datetime.now(timezone.utc).isoformat()


def clean(value):
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix=".writing-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(clean(value), f, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)


def write_compressed_json(path, value):
    # Run directories are private until current.json is replaced.
    with open(path, "wb") as file:
        with gzip.GzipFile(fileobj=file, mode="wb", filename="", mtime=0) as compressed:
            with io.TextIOWrapper(compressed, encoding="utf-8") as text:
                json.dump(clean(value), text, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def first(row, *keys):
    for key in keys:
        value = row.get(key)
        if value is not None and value != "":
            return value
    return None


def team(value):
    return ALIASES.get(value, value)


def phase(value):
    if value in POST:
        return "POST"
    if value in {"REG", "PRE"}:
        return value
    raise ValueError(f"Unknown season type: {value!r}")


def require(rows, columns, label):
    if not rows:
        raise ValueError(f"{label}: empty dataset; not publishing")
    missing = set(columns) - rows[0].keys()
    if missing:
        raise ValueError(f"{label}: missing columns {sorted(missing)}")


def unique(rows, keys, label):
    seen = set()
    for row in rows:
        key = tuple(row.get(k) for k in keys)
        if any(v is None or v == "" for v in key):
            raise ValueError(f"{label}: missing identifier {key}")
        if key in seen:
            raise ValueError(f"{label}: duplicate key {key}")
        seen.add(key)


class ReleaseSource:
    def __init__(self, root, refresh=False, offline=False, retries=3, timeout=60):
        self.root = Path(root)
        self.refresh, self.offline = refresh, offline
        self.retries, self.timeout = retries, timeout
        self.loaded = {}

    def spec(self, dataset, season):
        return {
            "schedule": (f"{RELEASE}/schedules/games.parquet", "shared/games.parquet"),
            "teams": (TEAM_URL, "shared/teams.csv"),
            "rosters": (f"{RELEASE}/rosters/roster_{season}.parquet", f"{season}/rosters.parquet"),
            "player_stats": (f"{RELEASE}/stats_player/stats_player_week_{season}.parquet", f"{season}/player_stats.parquet"),
            "team_stats": (f"{RELEASE}/stats_team/stats_team_week_{season}.parquet", f"{season}/team_stats.parquet"),
        }[dataset]

    @staticmethod
    def read(path, suffix):
        if suffix == ".csv":
            with open(path, encoding="utf-8-sig", newline="") as f:
                return list(csv.DictReader(f))
        import pyarrow.parquet as pq
        return clean(pq.read_table(path).to_pylist())

    def load(self, dataset, season):
        url, relative = self.spec(dataset, season)
        path = self.root / relative
        if relative not in self.loaded:
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists() and (not self.refresh or self.offline):
                rows = self.read(path, path.suffix)
            elif self.offline:
                raise FileNotFoundError(f"Offline cache missing: {path}")
            else:
                rows = self.download(url, path)
            if dataset in {"schedule", "teams"}:
                self.loaded[relative] = rows
        else:
            rows = self.loaded[relative]
        if dataset != "teams":
            rows = [r for r in rows if int(r.get("season", 0)) == season]
        return rows, {"url": url, "cacheFile": relative,
                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                      "cachedAtUtc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}

    def download(self, url, path):
        for attempt in range(1, self.retries + 1):
            fd, temporary = tempfile.mkstemp(dir=path.parent, suffix=path.suffix)
            os.close(fd)
            try:
                request = Request(url, headers={"User-Agent": "GamePulse-NFL-collector/0.1"})
                with urlopen(request, timeout=self.timeout) as response, open(temporary, "wb") as f:
                    shutil.copyfileobj(response, f)
                rows = self.read(temporary, path.suffix)
                if not rows:
                    raise ValueError(f"Empty release: {url}")
                os.replace(temporary, path)
                return rows
            except HTTPError as error:
                if error.code not in {408, 429, 500, 502, 503, 504} or attempt == self.retries:
                    raise
            except Exception:
                if attempt == self.retries:
                    raise
            finally:
                Path(temporary).unlink(missing_ok=True)
            time.sleep(min(2 ** (attempt - 1), 8))


def build(season, raw):
    schedule, metadata, rosters, player_rows, team_rows = (raw[k] for k in DATASETS)
    require(schedule, ["game_id", "season", "week", "game_type", "home_team", "away_team", "home_score", "away_score"], "schedule")
    require(metadata, ["team_abbr", "team_name"], "teams")
    require(rosters, ["season", "team", "gsis_id"], "rosters")
    require(player_rows, ["season", "week", "season_type", "player_id", "team"], "player_stats")
    require(team_rows, ["season", "week", "season_type", "team"], "team_stats")
    unique(schedule, ["game_id"], "schedule")
    games, index = [], {}
    for r in schedule:
        typ = phase(r["game_type"])
        home, away = team(r["home_team"]), team(r["away_team"])
        if not home or not away or home == away:
            raise ValueError("Invalid schedule opponents")
        hs, aws = r.get("home_score"), r.get("away_score")
        if (hs is None) != (aws is None):
            raise ValueError(f"One-sided score: {r['game_id']}")
        if any(v is not None and (float(v) < 0 or not float(v).is_integer()) for v in (hs, aws)):
            raise ValueError(f"Invalid score: {r['game_id']}")
        kickoff = None
        if r.get("gameday") and r.get("gametime"):
            local = datetime.fromisoformat(f"{r['gameday']}T{r['gametime']}")
            kickoff = local.replace(tzinfo=ZoneInfo("America/New_York")).astimezone(timezone.utc).isoformat()
        game = {"gameId": str(r["game_id"]), "season": season, "seasonType": typ,
                "round": r["game_type"], "week": int(r["week"]), "date": r.get("gameday"),
                "kickoffUtc": kickoff, "homeTeamId": home, "awayTeamId": away,
                "homeScore": int(hs) if hs is not None else None,
                "awayScore": int(aws) if aws is not None else None,
                "status": "final" if hs is not None else "scheduled",
                "stadium": r.get("stadium"), "espnId": str(r["espn"]) if r.get("espn") else None}
        games.append(game)
        for code in (home, away):
            key = (season, typ, game["week"], code)
            if key in index:
                raise ValueError(f"Ambiguous schedule join: {key}")
            index[key] = game
    games.sort(key=lambda g: (g["date"] or "", g["gameId"]))
    active = {g[k] for g in games for k in ("homeTeamId", "awayTeamId")}
    teams = {}
    # Prefer metadata whose abbreviation already matches our canonical ID.
    for r in sorted(metadata, key=lambda r: r["team_abbr"] != team(r["team_abbr"])):
        code = team(r["team_abbr"])
        if code in active and code not in teams:
            teams[code] = {"teamId": code, "sourceTeamId": r["team_abbr"], "name": r["team_name"],
                           "conference": r.get("team_conf"), "division": r.get("team_division"),
                           "color": r.get("team_color"), "logoUrl": first(r, "team_logo_espn", "team_logo_wikipedia")}
    if active - teams.keys():
        raise ValueError(f"Missing team metadata: {sorted(active - teams.keys())}")
    player_stats, team_stats, unassigned_stats = [], [], []
    identities = {"season", "week", "season_type", "team", "opponent_team", "player_id", "player_name",
                  "player_display_name", "position", "position_group", "headshot_url", "game_id"}
    for label, source_rows, dest in (("player_stats", player_rows, player_stats), ("team_stats", team_rows, team_stats)):
        for r in source_rows:
            typ, code = phase(r["season_type"]), team(r["team"])
            key = (season, typ, int(r["week"]), code)
            game = index.get(key)
            if not game:
                raise ValueError(f"{label}: no schedule match for {key}")
            if r.get("game_id") and str(r["game_id"]) != game["gameId"]:
                raise ValueError(f"{label}: game ID disagrees with schedule for {key}")
            opponent = game["awayTeamId"] if code == game["homeTeamId"] else game["homeTeamId"]
            if r.get("opponent_team") and team(r["opponent_team"]) != opponent:
                raise ValueError(f"{label}: opponent disagrees with schedule for {key}")
            record = {"season": season, "seasonType": typ, "week": int(r["week"]),
                      "gameId": game["gameId"], "teamId": code, "opponentTeamId": opponent,
                      "stats": {k: v for k, v in r.items() if k not in identities}}
            if label == "player_stats":
                record.update(playerId=r["player_id"], name=first(r, "player_display_name", "player_name"), position=r.get("position"))
                if not r["player_id"]:
                    # Upstream includes unassigned penalties/team events. Preserve
                    # these separately instead of inventing a player or dropping them.
                    unassigned_stats.append(record)
                    continue
            dest.append(record)
        keys = ["gameId", "teamId"] + (["playerId"] if label == "player_stats" else [])
        unique(dest, keys, label)
    players, roster_out = {}, []
    missing_roster_ids = 0
    for r in rosters:
        code, pid = team(r["team"]), r["gsis_id"]
        if code not in active:
            raise ValueError(f"Unknown roster team: {code}")
        roster_out.append({"season": season, "teamId": code, "playerId": pid,
                           "name": first(r, "full_name", "player_name"), "position": r.get("position"),
                           "jerseyNumber": r.get("jersey_number"), "status": r.get("status")})
        if not pid:
            missing_roster_ids += 1
            continue
        if pid not in players:
            players[pid] = {"playerId": pid, "name": first(r, "full_name", "player_name"),
                            "position": r.get("position"), "teamIds": [], "espnId": r.get("espn_id"),
                            "headshotUrl": r.get("headshot_url")}
        if code not in players[pid]["teamIds"]:
            players[pid]["teamIds"].append(code)
    for r in player_stats:
        pid = r["playerId"]
        if pid not in players:
            players[pid] = {"playerId": pid, "name": r["name"], "position": r["position"],
                            "teamIds": [], "espnId": None, "headshotUrl": None}
        if r["teamId"] not in players[pid]["teamIds"]:
            players[pid]["teamIds"].append(r["teamId"])
    records = {}
    for code in sorted(active):
        for typ in ("REG", "POST"):
            records[(code, typ)] = {"teamId": code, "seasonType": typ, "wins": 0, "losses": 0,
                                     "ties": 0, "played": 0, "pointsFor": 0, "pointsAgainst": 0}
    for g in games:
        if g["status"] != "final" or g["seasonType"] == "PRE":
            continue
        for own, other, pf, pa in (("homeTeamId", "awayTeamId", "homeScore", "awayScore"),
                                  ("awayTeamId", "homeTeamId", "awayScore", "homeScore")):
            r = records[(g[own], g["seasonType"])]
            a, b = g[pf], g[pa]
            r["played"] += 1
            r["pointsFor"] += a
            r["pointsAgainst"] += b
            r["wins" if a > b else "losses" if a < b else "ties"] += 1
    expected = {(g["gameId"], g[k]) for g in games if g["status"] == "final" and g["seasonType"] != "PRE"
                for k in ("homeTeamId", "awayTeamId")}
    observed = {(r["gameId"], r["teamId"]) for r in team_stats}
    missing_team_games = sorted(expected - observed)
    # This is coverage, not an assertion of official historical completeness.
    coverage = {"games": len(games), "completedGames": sum(g["status"] == "final" for g in games),
                "teams": len(teams), "players": len(players), "rosters": len(roster_out),
                "playerStats": len(player_stats), "teamStats": len(team_stats),
                "unassignedPlayerStatRows": len(unassigned_stats),
                "rosterRowsWithoutPlayerId": missing_roster_ids,
                "missingCompletedTeamGames": len(missing_team_games),
                "missingTeamGameKeys": missing_team_games,
                "playerStatColumns": sorted(set().union(*(r["stats"].keys() for r in player_stats)))}
    return {"games": games, "teams": list(teams.values()), "players": list(players.values()),
            "rosters": roster_out, "player_stats": player_stats, "team_stats": team_stats,
            "unassigned_stats": unassigned_stats, "records": list(records.values())}, coverage


def publish(root, season, output, coverage, sources):
    processed = Path(root) / "processed"
    base = processed / "seasons" / str(season)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
    run = base / "runs" / run_id
    run.mkdir(parents=True)
    files = {}
    generated = now()
    for name, rows in output.items():
        path = run / f"{name}.json.gz"
        write_compressed_json(path, {"schemaVersion": 1, "league": "NFL", "season": season,
                          "generatedAtUtc": generated, "count": len(rows), "data": rows})
        files[name] = {"path": str(path.relative_to(processed)), "encoding": "gzip", "count": len(rows),
                       "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    manifest = {"schemaVersion": 1, "league": "NFL", "season": season, "runId": run_id,
                "generatedAtUtc": generated, "files": files, "coverage": coverage, "sources": sources,
                "notes": ["Historical batch feed; status is inferred from score availability, not live game state.",
                          "Records omit NFL tiebreaker rankings. Missing statistics remain null."]}
    write_json(run / "manifest.json", manifest)
    # One atomic pointer change makes a complete, validated run visible.
    write_json(base / "current.json", manifest)
    rebuild_index(root)
    return manifest


def rebuild_index(root):
    processed = Path(root) / "processed"
    seasons = []
    for pointer in sorted((processed / "seasons").glob("*/current.json")):
        manifest = json.loads(pointer.read_text())
        seasons.append({"season": manifest["season"], "generatedAtUtc": manifest["generatedAtUtc"],
                        "manifestPath": str(pointer.relative_to(processed)), "coverage": manifest["coverage"]})
    write_json(processed / "seasons.json", {"schemaVersion": 1, "league": "NFL", "data": seasons})


@contextmanager
def collector_lock(root):
    # Advisory locks are released by the OS after a crash; no stale-lock deletion needed.
    import fcntl
    path = Path(root) / ".collector.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("Another NFL collector is running for this output folder")
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def collect(root, seasons, source, allow_partial=False):
    reports = Path(root) / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    attempt = {"startedAtUtc": now(), "seasons": []}
    failed = False
    for season in seasons:
        entry = {"season": season, "status": "running", "datasets": {}}
        attempt["seasons"].append(entry)
        raw, sources = {}, {}
        for dataset in DATASETS:
            try:
                print(f"{season}: loading {dataset}", flush=True)
                raw[dataset], sources[dataset] = source.load(dataset, season)
                entry["datasets"][dataset] = {"status": "ok", "rows": len(raw[dataset])}
            except Exception as error:
                entry["datasets"][dataset] = {"status": "failed", "error": str(error)}
                failed = True
        try:
            if len(raw) != len(DATASETS):
                raise ValueError("Required downloads failed; previous published season retained")
            output, coverage = build(season, raw)
            entry["coverage"] = coverage
            if coverage["missingCompletedTeamGames"] and not allow_partial:
                raise ValueError("Team stats missing for completed games; retry later or explicitly use --allow-partial")
            manifest = publish(root, season, output, coverage, sources)
            entry.update(status="published", runId=manifest["runId"])
            print(f"{season}: published {coverage['games']} games, {coverage['players']} players", flush=True)
        except Exception as error:
            failed = True
            entry.update(status="failed", error=str(error))
            print(f"{season}: FAILED: {error}", file=sys.stderr, flush=True)
        write_json(reports / "latest_attempt.json", attempt)
    attempt["finishedAtUtc"] = now()
    write_json(reports / "latest_attempt.json", attempt)
    write_json(reports / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8] + ".json"), attempt)
    with (reports / "coverage.csv").open("w", newline="", encoding="utf-8") as f:
        fields = ["season", "status", "games", "completedGames", "teams", "players", "playerStats", "teamStats", "missingCompletedTeamGames", "error"]
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for e in attempt["seasons"]:
            writer.writerow({**e, **e.get("coverage", {})})
    return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=2025)
    parser.add_argument("--end", type=int, help="Inclusive end season; defaults to --start")
    parser.add_argument("--output", type=Path, default=Path("data/nfl"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--refresh", action="store_true", help="Redownload requested assets, including shared metadata")
    mode.add_argument("--offline", action="store_true", help="Rebuild using cached raw files only")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=60, help="Network socket timeout in seconds")
    parser.add_argument("--allow-partial", action="store_true", help="Allow missing completed team-game stats; coverage remains explicit")
    args = parser.parse_args()
    end = args.end if args.end is not None else args.start
    today = datetime.now(timezone.utc)
    latest = today.year if today.month >= 3 else today.year - 1
    if not 1999 <= args.start <= end <= latest:
        parser.error(f"Seasons must satisfy 1999 <= start <= end <= {latest}")
    if args.retries < 1 or args.timeout < 1:
        parser.error("--retries and --timeout must be positive")
    source = ReleaseSource(args.output / "raw", args.refresh, args.offline, args.retries, args.timeout)
    try:
        with collector_lock(args.output):
            rebuild_index(args.output)
            return collect(args.output, range(args.start, end + 1), source, args.allow_partial)
    except (RuntimeError, ImportError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
