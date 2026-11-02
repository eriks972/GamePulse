#!/usr/bin/env python3
"""Import NBA-ID player statistics from SportsDataverse releases, without pandas.

Seasons use START years: --start 2023 --end 2025 imports 2023-24 through 2025-26.
Raw downloads are temporary. Each season is one atomically replaced ZIP.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile
import time
import urllib.request
import zipfile

PHASES = {"2": "regular-season", "4": "playoffs"}
FIELDS = {"points": "pts", "rebounds": "reb", "assists": "ast", "steals": "stl",
          "blocks": "blk", "turnovers": "tov", "fgm": "fgm", "fga": "fga",
          "fg3m": "fg3m", "fg3a": "fg3a", "ftm": "ftm", "fta": "fta"}
BOX = {"points": "points", "rebounds": "rebounds_total", "assists": "assists",
       "steals": "steals", "blocks": "blocks", "turnovers": "turnovers",
       "fgm": "field_goals_made", "fga": "field_goals_attempted",
       "fg3m": "three_pointers_made", "fg3a": "three_pointers_attempted",
       "ftm": "free_throws_made", "fta": "free_throws_attempted"}
SOURCES = {"season": ("nba_stats_player_season_stats", "player_season_stats"),
           "box": ("nba_stats_player_boxscores", "player_boxscores"),
           "dates": ("nba_stats_player_game_logs", "player_game_logs")}


def encoded(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def number(value, name, integer=False):
    if value is None or str(value).strip() == "":
        raise ValueError(f"Missing {name}")
    n = float(value)
    if not math.isfinite(n) or n < 0 or (integer and not n.is_integer()):
        raise ValueError(f"Invalid {name}: {value}")
    return int(n) if integer else n


def pid(value):
    n = number(value, "NBA player ID", True)
    if n < 1:
        raise ValueError("Invalid NBA player ID")
    return n


def rows(raw, required):
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    if not required.issubset(reader.fieldnames or []):
        raise ValueError(f"Source missing required columns: {sorted(required - set(reader.fieldnames or []))}")
    return list(reader)


def minutes(value):
    if re.fullmatch(r"\d+:\d{2}(?:\.\d+)?", value or ""):
        m, s = map(float, value.split(":"))
        if s > 60:
            raise ValueError("Invalid seconds in minutes")
        # The released V3 CSV includes rounded values such as 30:60.
        # Carry exactly 60 seconds into the next minute, preserving duration.
        return m + s / 60
    return number(value, "minutes")


def shooting(totals):
    return {key: totals[m] / totals[a] if totals[a] else None
            for key, m, a in [("fg", "fgm", "fga"), ("three", "fg3m", "fg3a"), ("ft", "ftm", "fta")]}


def validate_shooting(t):
    if any(t[m] > t[a] for m, a in [("fgm", "fga"), ("fg3m", "fg3a"), ("ftm", "fta")]):
        raise ValueError("Made shots exceed attempts")
    if t["fg3m"] > t["fgm"] or t["fg3a"] > t["fga"]:
        raise ValueError("Three-point shots exceed field goals")
    if t["points"] != 2 * t["fgm"] + t["fg3m"] + t["ftm"]:
        raise ValueError("Points disagree with made shots")


def prepare(year, sources, imported_at):
    seasons = rows(sources["season"], {"player_id", "player_name", "season", "season_type", "measure_type", "per_mode", "gp", "min", *FIELDS.values()})
    boxes = rows(sources["box"], {"person_id", "game_id", "team_id", "team_tricode", "minutes", "season", "season_type_id", *BOX.values()})
    dates = rows(sources["dates"], {"game_id", "team_id", "game_date", "matchup", "wl", "season"})
    if not seasons or not boxes or not dates:
        raise ValueError("Empty season source")
    for records in [seasons, boxes, dates]:
        if any(number(r["season"], "season", True) != year + 1 for r in records):
            raise ValueError("Source contains the wrong END-year season")
    metadata = {}
    for r in dates:
        key = (r["game_id"].zfill(10), r["team_id"])
        value = {"date": r["game_date"][:10], "matchup": r["matchup"], "result": r["wl"]}
        datetime.strptime(value["date"], "%Y-%m-%d")
        if key in metadata and metadata[key] != value:
            raise ValueError("Conflicting game dates/team metadata")
        metadata[key] = value
    logs = defaultdict(list)
    seen = set()
    skipped = 0
    for r in boxes:
        game_id = r["game_id"].zfill(10)
        if not re.fullmatch(r"00[124569]\d{7}", game_id):
            raise ValueError(f"Invalid NBA game ID: {game_id}")
        if game_id[3:5] != str(year)[-2:]:
            raise ValueError("Game ID belongs to a different START-year season")
        phase = PHASES.get(r["season_type_id"])
        if game_id[2] != r["season_type_id"]:
            raise ValueError("Game ID/type disagreement")
        if not phase:
            skipped += 1
            continue  # Play-in/Cup final/preseason are not regular season/playoffs.
        player = pid(r["person_id"])
        key = (player, game_id)
        if key in seen:
            raise ValueError(f"Duplicate player/game: {key}")
        seen.add(key)
        if not r["minutes"].strip():
            if any(number(r[k] or "0", k) != 0 for k in BOX.values()):
                raise ValueError("DNP row contains statistics")
            continue
        totals = {k: number(r[v], v, True) for k, v in BOX.items()}
        validate_shooting(totals)
        meta = metadata.get((game_id, r["team_id"]))
        if meta is None:
            raise ValueError(f"Missing date/team metadata for {game_id}")
        logs[player, phase].append({"gameId": game_id, "teamId": number(r["team_id"], "team ID", True),
            "teamAbbreviation": r["team_tricode"], **meta, "minutes": minutes(r["minutes"]), **totals})
    summaries = []
    summary_keys = set()
    mismatches = []
    for r in seasons:
        if r["measure_type"] != "base" or r["per_mode"] != "totals" or r["season_type"] not in PHASES.values():
            continue  # Never add per-game, advanced, totals and team-stint rows together.
        player, phase = pid(r["player_id"]), r["season_type"]
        key = (player, phase)
        if key in summary_keys:
            raise ValueError("Duplicate season totals: do not double-count combined/team-stint rows")
        summary_keys.add(key)
        gp = number(r["gp"], "games", True)
        if not gp:
            continue
        totals = {k: number(r[v], v, True) for k, v in FIELDS.items()}
        validate_shooting(totals)
        totals["minutes"] = number(r["min"], "minutes")
        games = sorted(logs[key], key=lambda g: (g["date"], g["gameId"]), reverse=True)
        verified = len(games) == gp and all(sum(g[k] for g in games) == totals[k] for k in FIELDS)
        if not verified:
            mismatches.append({"playerId": player, "type": phase, "expectedGames": gp, "availableGames": len(games)})
        summaries.append({"playerId": player, "playerName": r["player_name"], "season": year,
            "seasonType": phase, "teamAbbreviation": r.get("team_abbreviation", ""), "games": gp,
            "totals": totals, "perGame": {k: v / gp for k, v in totals.items()},
            "shooting": shooting(totals), "availableGameLogs": len(games), "logsReconcile": verified})
        logs[key] = games
    if len(summaries) < 30:
        raise ValueError("Unexpectedly small NBA season totals source")
    if set(logs) - summary_keys:
        raise ValueError("Game-log players have no matching season summary")
    manifest = {"schemaVersion": 1, "season": year, "importedAt": imported_at,
        "source": "SportsDataverse / NBA Stats", "sourceSeason": year + 1,
        "sources": [{"url": source_url(k, year), "sha256": sha(v)} for k, v in sources.items()],
        "summaryCount": len(summaries), "gameLogCount": sum(len(v) for v in logs.values()),
        "excludedNonRegularOrPlayoffRows": skipped, "coverageIssues": mismatches,
        "note": "Regular season and playoffs are separate. Coverage reflects source availability, not a claim of a complete season."}
    return summaries, logs, manifest


def source_url(key, year):
    tag, prefix = SOURCES[key]
    return f"https://github.com/sportsdataverse/sportsdataverse-data/releases/download/{tag}/{prefix}_{year + 1}.csv"


def fetch(key, year):
    url = source_url(key, year)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GamePulse-NBA-Collector/1.0"}), timeout=30) as response:
                raw = response.read(40 * 1024 * 1024 + 1)
            if len(raw) > 40 * 1024 * 1024:
                raise ValueError("Source exceeds 40 MiB limit")
            return key, raw
        except OSError:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def archive_bytes(summaries, logs, manifest):
    entries = {"summary.json": encoded(summaries)}
    entries.update({f"players/{p}/{t}.json": encoded(games) for (p, t), games in logs.items() if games})
    manifest = {**manifest, "entries": {name: sha(raw) for name, raw in entries.items()}}
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, raw in {"manifest.json": encoded(manifest), **entries}.items():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, raw, compresslevel=9)
    return output.getvalue()


def verify_archive(raw, year):
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if len(z.namelist()) != len(set(z.namelist())) or z.testzip():
            raise ValueError("Corrupt or duplicate archive entries")
        manifest = json.loads(z.read("manifest.json"))
        if manifest["schemaVersion"] != 1 or manifest["season"] != year:
            raise ValueError("Archive schema/season mismatch")
        if set(z.namelist()) != set(manifest["entries"]) | {"manifest.json"}:
            raise ValueError("Archive manifest entries disagree")
        for name, checksum in manifest["entries"].items():
            if name != "summary.json" and not re.fullmatch(r"players/[1-9]\d*/(?:regular-season|playoffs)\.json", name):
                raise ValueError("Unexpected archive path")
            if sha(z.read(name)) != checksum:
                raise ValueError("Archive entry checksum mismatch")
        return manifest


def atomic_write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", type=Path, required=True)
    p.add_argument("--start", type=int, required=True, help="START year, e.g. 2023 for 2023-24")
    p.add_argument("--end", type=int, required=True)
    p.add_argument("--input-dir", type=Path, help="Read original source CSVs from disk for offline preparation")
    p.add_argument("--bundle-dir", type=Path, help="Install already prepared YYYY.zip files, offline")
    a = p.parse_args()
    if not 1946 <= a.start <= a.end <= datetime.now().year:
        p.error("Invalid season range")
    repo = a.repo.expanduser().resolve()
    if not (repo / "backend/GamePulse.Api/GamePulse.Api.csproj").exists():
        p.error("--repo must point to GamePulse's root")
    root = repo / "backend/GamePulse.Api/Data/processed/nba_player_stats"
    root.mkdir(parents=True, exist_ok=True)
    lock = root / ".import.lock"
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        for year in range(a.start, a.end + 1):
            if a.bundle_dir:
                raw = (a.bundle_dir / f"{year}.zip").read_bytes()
            else:
                if a.input_dir:
                    sources = {k: (a.input_dir / f"{prefix}_{year + 1}.csv").read_bytes() for k, (_, prefix) in SOURCES.items()}
                else:
                    with ThreadPoolExecutor(max_workers=3) as pool:
                        sources = dict(pool.map(lambda key: fetch(key, year), SOURCES))
                prepared = prepare(year, sources, datetime.now(timezone.utc).isoformat(timespec="seconds"))
                raw = archive_bytes(*prepared)
            manifest = verify_archive(raw, year)
            path = root / f"{year}.zip"
            if path.exists():
                old = verify_archive(path.read_bytes(), year)
                if {s["url"]: s["sha256"] for s in old["sources"]} == {s["url"]: s["sha256"] for s in manifest["sources"]}:
                    print(f"{year}: source data unchanged; installed archive retained", flush=True)
                    continue
                if old["importedAt"] > manifest["importedAt"] or old["gameLogCount"] > manifest["gameLogCount"]:
                    raise ValueError(f"Refusing older/reduced coverage for {year}; installed archive preserved")
            atomic_write(path, raw)
            print(f"{year}-{str(year+1)[-2:]}: {manifest['summaryCount']} season summaries; {manifest['gameLogCount']} player game logs; {len(manifest['coverageIssues'])} coverage discrepancies; {len(raw):,} bytes", flush=True)
    finally:
        lock.unlink()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise SystemExit(f"NBA statistics import stopped: {exc}. Previously completed seasons remain installed.") from exc
