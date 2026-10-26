# GamePulse NFL starter — v0.1

This is a standalone data pipeline for the NFL module. It runs alongside the MLB
collector without modifying MLB, NBA, WNBA, your backend, or your frontend.
It includes validated 2025 and 2026 snapshots, the collector, tests, and an API
integration contract. The actual ASP.NET controllers and Next.js pages still
need to be connected to the current GamePulse source.

## Quick start on your Mac

Unzip the package. In Terminal, change into the extracted `gamepulse-nfl-starter`
folder. You can move that folder to `gamepulse/tools/nfl` if you prefer to keep
the collector inside your project. All commands below run from that folder.

```bash
python3 -m venv .venv-nfl
source .venv-nfl/bin/activate
python -m pip install -r requirements-nfl.txt
python scripts/prepare_nfl.py --start 2025
```

Use Python 3.10 or newer. Tested here with Python 3.12 and PyArrow 26. The lock
uses `fcntl`, so this version supports macOS and Linux. Run the collector on your
laptop or a separate ingestion job; it does not need to run inside the Render API.
There are no API keys. The only required third-party dependency is PyArrow.

The default output is `data/nfl` relative to your current working directory.
Existing snapshots are usable before downloading anything; the command above
fetches raw files for local rebuilding. A successful run prints its published
game and player counts and exits with code 0. Any failed season exits with code 1.

### Current season, refresh, and historical backfill

```bash
# First collection for the current 2026 season
python scripts/prepare_nfl.py --start 2026

# Fetch new upstream data for 2026 on subsequent runs
python scripts/prepare_nfl.py --start 2026 --refresh

# Rebuild 2025 and 2026 without a network request, after raw files are cached
python scripts/prepare_nfl.py --start 2025 --end 2026 --offline

# Backfill a small historical batch, inclusive at both ends
python scripts/prepare_nfl.py --start 2020 --end 2024

# Tests use synthetic fixtures and make no network requests
python -m unittest discover -s tests -v
```

Normal runs reuse downloaded assets and retry missing downloads. A failed or
interrupted file transfer restarts that file; this is dataset-level resumption,
not HTTP byte-range resumption. `--refresh` bypasses the local cache. Upstream
CDN caching may still affect freshness. Reuse one output folder for a backfill
so shared schedule and team downloads are reused. Only shared tables remain
cached in memory between seasons.

Seasons from 1999 through the current NFL season are accepted, but source
coverage is checked per season. This does not promise identical historical
coverage for every statistic. No recurring job or scheduled automation is set up.

## Output files

| Path | Purpose |
|---|---|
| `data/nfl/raw/shared/` | Cached schedule and team sources; excluded from delivery and Git |
| `data/nfl/raw/YEAR/` | Cached roster and weekly stats source files; excluded from delivery and Git |
| `data/nfl/processed/seasons.json` | Available published seasons |
| `data/nfl/processed/seasons/YEAR/current.json` | Authoritative manifest for the latest successful season run |
| `data/nfl/processed/seasons/YEAR/runs/RUN/` | Immutable files for a published run |
| `data/nfl/reports/latest_attempt.json` | Dataset statuses, errors, and coverage for the last invocation |
| `data/nfl/reports/coverage.csv` | Coverage summary for seasons requested in the last invocation |

Each run contains compressed JSON files for `games`, `teams`, `players`,
`rosters`, `player_stats`, `team_stats`, `unassigned_stats`, and `records`.
Every file uses the same envelope:

```json
{"schemaVersion":1,"league":"NFL","season":2025,"generatedAtUtc":"...","count":285,"data":[]}
```

The example's `data` array is omitted for brevity. Each manifest includes actual
row counts, compressed byte sizes, SHA-256 hashes, source URLs, source-file hashes,
cache timestamps, and coverage details. Files are gzip compressed to keep the
deployable dataset small; all source stat fields are retained in the raw cache
and the weekly `stats` dictionaries.

### Read a shipped season snapshot

```bash
python - <<'PY'
import gzip
import json
from pathlib import Path
base = Path('data/nfl/processed')
manifest = json.loads((base / 'seasons/2025/current.json').read_text())
with gzip.open(base / manifest['files']['games']['path'], 'rt', encoding='utf-8') as f:
    games = json.load(f)['data']
print('Game count:', len(games))
print(games[0])
PY
```

## Correctness and publication rules

- The source `season` is preserved. January/February 2026 playoff games belong
  to the 2025 season; calendar year is not used to derive the NFL season.
- Kickoff times from the schedule are Eastern time. Conversion to UTC uses
  `America/New_York` and accounts for daylight saving time. Unknown times stay null.
- Source schedule rounds `WC`, `DIV`, `CON`, and `SB` normalize to `POST`, while
  the original round remains on each game. Regular and postseason records are separate.
- `final` is inferred from both scores being present in the historical batch
  feed. A missing score remains null, and zero is preserved as a valid score.
  This is not a live scoreboard; in-progress/postponed/canceled states need a
  separate live source in a later version.
- Player IDs use GSIS. Names are display fields, never join keys. Players who
  changed teams retain one identity plus all observed team IDs. Annual rosters
  are season associations, not a claim that a player is currently active there.
- Player-source rows without an ID are retained in `unassigned_stats`, excluded
  from player totals, and counted in coverage. Roster rows without IDs are kept
  in `rosters` and do not receive invented identities.
- `LA`, `STL` normalize to `LAR`; `SD` to `LAC`; `OAK` to `LV`; `JAC` to `JAX`.
  Raw source files retain historical codes. Current team branding in the shared
  metadata should not be interpreted as historical branding for relocated teams.
- Weekly player/team rows must match a scheduled game by season, phase, week,
  and canonical team. Provided game IDs and opponents must agree. Duplicate
  schedule and weekly stat keys fail validation.
- Fractional sacks, zero values, and missing values remain distinct. Rates and
  percentages are preserved as provided, not summed into season totals.
- `records` contains wins/losses/ties and points from scored games. It does not
  implement official NFL standings tiebreakers, seeding, or division rankings.
- All five datasets must load and validate before publication. Missing team
  stats for completed regular/postseason games block publication by default.
  `--allow-partial` explicitly permits that gap and records it in coverage.
  Coverage does not prove every individual player's stat line is complete.
- A complete run is written first, then `current.json` is replaced atomically.
  Failed downloads or validation preserve the previously published manifest.
  Readers should resolve the manifest once per request to stay on one run.
- A lock prevents two NFL collectors from writing to the same output folder.
  MLB can run separately. Old NFL runs are retained; no automatic cleanup occurs.

If a release is unavailable or validation fails, inspect
`data/nfl/reports/latest_attempt.json`. Use `--refresh` to replace a stale or
invalid raw cache after the upstream data has been corrected. Do not delete your
working processed data to retry a download.

## Backend/frontend integration to do next

See `INTEGRATION.md`. This package does not alter `Program.cs`, project publish
settings, MLB storage targets, CORS, or deployed services. Include only the
processed NFL data when deploying the API; raw data and ingestion dependencies
belong outside the API image.

## Sources and the SportsDataverse compatibility choice

The starting point is the [SportsDataverse NFL documentation](https://py.sportsdataverse.org/docs/nfl/).
Its schedule, roster, and weekly team/player loaders reference nflverse assets.
The installed PyPI release tested here, `sportsdataverse==0.1.4`, exposes an older
`load_nfl_player_stats(kicking=False, ...)` signature without a season argument.
The current documentation describes newer per-season weekly releases. It also
describes a legacy output contract that omits additional defensive columns.

This starter reads the documented underlying assets directly instead of
depending on that changing wrapper. It retains weekly defensive and kicking
fields and avoids installing SportsDataverse's unrelated modeling dependencies.

Upstream attribution: nflverse/nflfastR contributors, distributed through
[nflverse-data](https://github.com/nflverse/nflverse-data). Source URLs:

- Schedule: `https://github.com/nflverse/nflverse-data/releases/download/schedules/games.parquet`
- Teams: `https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/teams_colors_logos.csv`
- Rosters: `https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.parquet`
- Players: `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.parquet`
- Teams by week: `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_{season}.parquet`

The package is an ingestion starter with validation, not a completed deployed NFL
feature. Keep the accompanying validation report with the starter for the exact
data counts and limitations of this delivery.
