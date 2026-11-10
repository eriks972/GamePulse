#!/usr/bin/env python3
"""Refresh GamePulse's global NBA directory. Python 3.9+, standard library only."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time
import urllib.parse
import urllib.request

BASE = "https://stats.nba.com/stats/"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def integer(value, field):
    if isinstance(value, bool) or value is None or str(value).strip() == "":
        raise ValueError(f"Missing/invalid {field}: {value!r}")
    number = float(value)
    if not number.is_integer() or number < 0:
        raise ValueError(f"Invalid {field}: {value!r}")
    return int(number)


def table(payload, name, season, required):
    params = payload.get("parameters", {})
    if params.get("Season") != season or params.get("LeagueID") != "00":
        raise ValueError("Source season/league does not match requested NBA query")
    if name == "PlayerIndex" and integer(params.get("Historical"), "Historical") != 1:
        raise ValueError("PlayerIndex must include Historical=1")
    if name == "CommonAllPlayers" and integer(params.get("IsOnlyCurrentSeason"), "IsOnlyCurrentSeason") != 0:
        raise ValueError("CommonAllPlayers must include IsOnlyCurrentSeason=0")
    sets = [s for s in payload.get("resultSets", []) if s.get("name") == name]
    if len(sets) != 1:
        raise ValueError(f"Expected exactly one {name} table")
    headers = sets[0].get("headers", [])
    if len(headers) != len(set(headers)) or not required.issubset(headers):
        raise ValueError(f"Invalid {name} headers")
    result = {}
    for values in sets[0].get("rowSet", []):
        if len(values) != len(headers):
            raise ValueError(f"Malformed {name} row")
        row = dict(zip(headers, values))
        pid = integer(row["PERSON_ID"], "PERSON_ID")
        if not pid or pid in result:
            raise ValueError(f"Duplicate/invalid NBA player ID: {pid}")
        result[pid] = row
    return result


def existing_catalog(raw):
    rows = json.loads(raw)
    if not isinstance(rows, list) or not rows:
        raise ValueError("Existing players.json must be a nonempty array")
    result = {}
    for row in rows:
        pid = integer(row.get("externalPlayerId"), "externalPlayerId")
        if not pid or pid in result or row.get("leagueSlug", "nba") != "nba":
            raise ValueError(f"Invalid/duplicate existing NBA player {pid}")
        result[pid] = row
    return result


def text(value):
    return "" if value is None else str(value).strip()


def merge(old, common_payload, index_payload, season, fetched_at):
    # Validate both independent endpoint tables before any change to disk.
    common = table(common_payload, "CommonAllPlayers", season, {
        "PERSON_ID", "DISPLAY_FIRST_LAST", "DISPLAY_LAST_COMMA_FIRST", "ROSTERSTATUS",
        "FROM_YEAR", "TO_YEAR", "TEAM_ID", "TEAM_CITY", "TEAM_NAME", "TEAM_ABBREVIATION",
        "TEAM_CODE", "PLAYERCODE", "GAMES_PLAYED_FLAG"})
    index = table(index_payload, "PlayerIndex", season, {
        "PERSON_ID", "PLAYER_FIRST_NAME", "PLAYER_LAST_NAME", "PLAYER_SLUG", "POSITION",
        "HEIGHT", "WEIGHT", "COLLEGE", "COUNTRY", "DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"})
    if set(common) != set(index):
        raise ValueError("NBA endpoint ID sets differ; retry the download, keeping the previous catalog")
    if len(common) < max(4500, len(old) * 0.8) or len(set(old) & set(common)) < len(old) * 0.8:
        raise ValueError("Source catalog is unexpectedly small or has insufficient existing-ID overlap")
    fetched = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    if fetched.tzinfo is None or fetched > datetime.now(timezone.utc).replace(microsecond=0):
        raise ValueError("Invalid snapshot timestamp")
    output = {k: dict(v) for k, v in old.items()}
    for pid, c in common.items():
        i = index[pid]
        p = dict(old.get(pid, {}))
        if p.get("catalogUpdatedAt") and datetime.fromisoformat(p["catalogUpdatedAt"].replace("Z", "+00:00")) > fetched:
            raise ValueError("Snapshot is older than the installed catalog; download a fresh snapshot")
        first, last = text(i["PLAYER_FIRST_NAME"]), text(i["PLAYER_LAST_NAME"])
        name = text(c["DISPLAY_FIRST_LAST"])
        if not name or not last:
            raise ValueError(f"Missing player name for {pid}")
        start, end = integer(c["FROM_YEAR"], "FROM_YEAR"), integer(c["TO_YEAR"], "TO_YEAR")
        if start < 1946 or end < start or end > fetched.year + 1:
            raise ValueError(f"Invalid career years for {pid}: {start}-{end}")
        status = integer(c["ROSTERSTATUS"], "ROSTERSTATUS")
        if status not in (0, 1):
            raise ValueError(f"Unknown roster status for {pid}: {status}")
        team_id = integer(c["TEAM_ID"], "TEAM_ID")
        p.update(externalPlayerId=pid, leagueSlug="nba", firstName=first, lastName=last,
                 fullName=name, displayLastCommaFirst=text(c["DISPLAY_LAST_COMMA_FIRST"]),
                 displayFiLast=f"{first[:1]}. {last}" if first else last,
                 slug=text(i["PLAYER_SLUG"]), playerCode=text(c["PLAYERCODE"]),
                 fromYear=start, toYear=end, rosterStatus="Active" if status else "Inactive",
                 externalTeamId=team_id,
                 catalogUpdatedAt=fetched_at, catalogRequestedSeason=season,
                 catalogSource="NBA CommonAllPlayers + PlayerIndex")
        # CommonAllPlayers supplies directory team/status. PlayerIndex can retain
        # a retired player's old team; never use that as a current assignment.
        for src, dest in [("TEAM_CITY", "teamCity"), ("TEAM_NAME", "teamName"),
                          ("TEAM_ABBREVIATION", "teamAbbreviation"), ("TEAM_CODE", "teamCode")]:
            p[dest] = text(c[src]) if team_id else ""
        positions = {"G": "Guard", "F": "Forward", "C": "Center"}
        pos = text(i["POSITION"])
        if pos:
            p["position"] = "-".join(positions.get(x, x) for x in pos.split("-"))
        for src, dest in [("HEIGHT", "height"), ("COLLEGE", "school"), ("COUNTRY", "country"),
                          ("DRAFT_YEAR", "draftYear"), ("DRAFT_ROUND", "draftRound"),
                          ("DRAFT_NUMBER", "draftNumber")]:
            if text(i[src]):
                p[dest] = text(i[src])
        if text(i["WEIGHT"]):
            p["weight"] = integer(i["WEIGHT"], "WEIGHT")
        # Jersey belongs to the listed directory team only, never a retired team.
        p["jersey"] = text(i.get("JERSEY_NUMBER")) if team_id else ""
        # Career games flag is NOT evidence of an appearance in the query season.
        flag = text(c["GAMES_PLAYED_FLAG"])
        if flag not in ("Y", "N"):
            raise ValueError(f"Invalid career games flag for {pid}")
        p["gamesPlayed"] = flag == "Y"
        p["gamesPlayedCurrentSeason"] = False
        p["seasonExperience"] = 0  # Not supplied by these bulk endpoints.
        defaults = {"birthdate": "", "lastAffiliation": "", "position": "", "school": "",
                    "country": "", "height": "", "weight": 0, "draftYear": "",
                    "draftRound": "", "draftNumber": "", "dLeague": False,
                    "nba": True, "greatest75": False}
        for k, v in defaults.items():
            p.setdefault(k, v)
        output[pid] = p
    result = sorted(output.values(), key=lambda p: (p["fullName"].casefold(), p["externalPlayerId"]))
    report = {"before": len(old), "source": len(common), "after": len(result),
              "added": len(set(common) - set(old)), "refreshed": len(set(common) & set(old)),
              "retainedLegacy": len(set(old) - set(common)),
              "snapshotAt": fetched_at, "requestedSeason": season,
              "statuses": dict(Counter(p["rosterStatus"] for p in result)),
              "note": "Global directory snapshot; not season rosters, appearances, or statistics."}
    return result, report


def request_json(endpoint, params):
    url = BASE + endpoint + "?" + urllib.parse.urlencode(params)
    error = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0",
                "Referer": "https://www.nba.com/", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise ValueError("NBA response exceeds 8 MiB limit")
            return json.loads(raw)
        except (OSError, ValueError) as exc:
            error = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise ValueError(f"NBA download failed for {endpoint}; existing data was not changed: {error}")


def download(season):
    params = dict.fromkeys(["Active", "AllStar", "College", "Country", "DraftPick",
                            "DraftYear", "Height", "PlayerPosition", "TeamID", "Weight"], "")
    params.update(LeagueID="00", Season=season, Historical="1")
    common = request_json("commonallplayers", {"LeagueID": "00", "Season": season, "IsOnlyCurrentSeason": "0"})
    index = request_json("playerindex", params)
    return {"schemaVersion": 1, "season": season, "fetchedAt": stamp(),
            "commonAllPlayers": common, "playerIndex": index}


def atomic_write(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def apply_catalog(path, original, result):
    lock = path.with_name(path.name + ".refresh.lock")
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(fd)
        if path.read_bytes() != original:
            raise ValueError("players.json changed during refresh; rerun against the latest file")
        # One small rollback copy, replaced each run; no accumulating dataset runs.
        backup = path.with_name(path.name + ".nba-refresh-backup")
        atomic_write(backup, original)
        atomic_write(path, encode(result))
    finally:
        lock.unlink()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", type=Path, required=True, help="GamePulse repository root")
    p.add_argument("--season", required=True, help="NBA query season, e.g. 2025-26; not a coverage cutoff")
    p.add_argument("--snapshot", type=Path, help="Use an offline bundle instead of downloading")
    p.add_argument("--save-snapshot", type=Path, help="Save downloaded bundle for reuse")
    p.add_argument("--apply", action="store_true", help="Write players.json atomically, keeping one backup")
    a = p.parse_args()
    if not re.fullmatch(r"\d{4}-\d{2}", a.season) or int(a.season[-2:]) != (int(a.season[:4]) + 1) % 100:
        p.error("Use a season such as 2025-26")
    path = a.repo.expanduser().resolve() / "backend/GamePulse.Api/Data/processed/players.json"
    original = path.read_bytes()
    old = existing_catalog(original)
    bundle = json.loads(a.snapshot.read_bytes()) if a.snapshot else download(a.season)
    if bundle.get("schemaVersion") != 1 or bundle.get("season") != a.season:
        raise ValueError("Snapshot schema/season mismatch")
    result, report = merge(old, bundle["commonAllPlayers"], bundle["playerIndex"], a.season, bundle["fetchedAt"])
    if a.save_snapshot:
        atomic_write(a.save_snapshot, encode(bundle))
    report.update(beforeSha256=digest(original), afterSha256=digest(encode(result)), applied=a.apply)
    if a.apply:
        apply_catalog(path, original, result)
    print(json.dumps(report, indent=2))
    print("Applied. Restart the backend." if a.apply else "Preview only. Add --apply to install this catalog.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SystemExit(f"NBA refresh stopped: {exc}") from exc
