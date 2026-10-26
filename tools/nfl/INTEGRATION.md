# NFL integration contract for GamePulse

These are proposed integration points, not existing routes. Adapt them to the
actual ASP.NET and Next.js conventions once the current source is available.

## API data service

Create an `NflDataService` that resolves
`Data/processed/nfl/seasons/{season}/current.json`. The collector's processed
folder is copied into `Data/processed/nfl`; paths inside its manifests remain
relative to that folder.

Read the selected manifest once. For each required dataset, open its `files`
entry's `path`, decode with `System.IO.Compression.GZipStream`, and deserialize
the envelope's `data`. Do not scan run folders or select runs by their names.
Cache on `(season, runId, dataset)`, with a bounded eviction policy. Load player
stats on demand so Render does not eagerly hold every sport and season in RAM.
Disk compression saves deployment space; it does not eliminate decompressed
memory usage. If needed, the next iteration can split weekly stats into week files.

Expose only validated seasons from `seasons.json`; use `current.json` as the
authoritative snapshot if an index refresh was interrupted. Return an explicit
404 for an unavailable season, not an empty successful response.

| Proposed route | Dataset / behavior |
|---|---|
| `GET /api/nfl/seasons` | Published seasons and coverage |
| `GET /api/nfl/games?season=2025&seasonType=REG&week=1` | Filter `games` |
| `GET /api/nfl/games/{gameId}?season=2025` | Game plus its team/player weekly stat rows |
| `GET /api/nfl/teams?season=2025` | Teams appearing in that schedule |
| `GET /api/nfl/teams/{teamId}?season=2025` | Team metadata, phase-specific record, games, roster associations |
| `GET /api/nfl/players?season=2025&page=1&pageSize=50` | Paginated player directory |
| `GET /api/nfl/players/{playerId}?season=2025` | Player identity and weekly stat rows |

Use a maximum page size and validate season/week/phase before filtering. Use
GSIS player IDs and source game IDs as opaque strings. Stats keys remain upstream
snake_case inside `stats`; identifiers and envelope keys are camelCase.
Display null statistics as unavailable. Do not infer zeros or combine rate
statistics by simple addition. For player season summaries, group regular and
postseason separately and recompute rates from valid denominators.

## Deployment

Copy `data/nfl/processed/` to `backend/GamePulse.Api/Data/processed/nfl/` after the
existing publish configuration has been reviewed. Required runtime files include
`seasons.json`, each `current.json`, and the run files referenced by those
manifests. Publish rules must include `.json.gz` as well as `.json`.

The compressed files are app data. Decode them in the service and let the API's
normal HTTP compression handle responses. If serving the files directly instead,
set `Content-Encoding: gzip` and `Content-Type: application/json` appropriately.

Do not copy raw source files, Python environments, tests, or all old runs into
the API image. The current MLB storage targets must be read before changing any
shared copy/cleanup rules. This starter makes no assumptions about those targets.

## Next.js pages

Add NFL to the existing league navigation and create season-aware games, team,
and player views. A week selector must distinguish REG from POST. Avoid assuming
every season has 18 regular-season weeks, 17 games per team, or 32 active teams.
Use a historical/batch update label with the manifest timestamp, not a live badge.
Add loading, unavailable-season, and API-error states before wiring rankings or
comparisons. Existing NBA/WNBA/MLB URLs and response contracts can remain intact.

## Completion boundary

Completed here: collection, normalization, source joins, coverage reporting,
compressed snapshots, failure-safe publication, tests, and this contract.

Pending current repository access: actual C# service/controllers, project publish
rules, application registration, TypeScript types/API client, Next.js views, and
local/deployed end-to-end validation.
