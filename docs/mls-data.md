# MLS coverage

MLS pages read `GET /api/leagues/mls/season?season=2026` from the same `NEXT_PUBLIC_API_BASE_URL` as other leagues (default `http://localhost:5241`). Without a season query the API selects the latest imported year. No imported files, a missing season, an offline backend, or an invalid file produces a data-unavailable view rather than breaking the page.

## Add a season

Place one JSON file per year at `backend/GamePulse.Api/Data/processed/mls/seasons/YYYY.json`. Override this directory using backend configuration `Mls:DataPath` (environment variable `Mls__DataPath`). Files are reread on every request; refresh a page after adding or replacing data. Replace files atomically to avoid readers seeing a partial write. On deployed hosting, upload files into the configured persistent directory or include them in the backend deployment.

The following is a **schema example**, not real MLS data. Use real imported identities, names, dates, results, and statistics. All collections can be empty; omit unknown scores and metrics or set them to null. Do not represent missing metrics as zero.

```json
{
  "season": 2026,
  "teams": [
    { "id": "team-a", "name": "Team A", "abbreviation": "A", "conference": "Eastern", "venue": "Stadium A" },
    { "id": "team-b", "name": "Team B", "conference": "Western" }
  ],
  "players": [
    { "id": "player-a", "name": "Player A", "teamId": "team-a", "position": "Forward" }
  ],
  "games": [
    { "id": "match-a", "date": "2026-03-01", "homeTeamId": "team-a", "awayTeamId": "team-b", "seasonType": "Regular Season", "status": "Final", "completed": true, "homeScore": 2, "awayScore": 1 }
  ],
  "teamStats": [
    { "id": "team-a", "statistics": { "goals": 2, "shots": 12, "shotsOnTarget": 5, "possessionPercentage": 54.2 } }
  ],
  "playerStats": [
    { "id": "player-a", "statistics": { "goals": 1, "assists": 0, "minutes": 90 } }
  ]
}
```

IDs must be unique within each collection and stable for links. Game team IDs, player team IDs, and stat IDs must reference their corresponding entities. Statistics contain one season aggregate per team/player and phase; use consistent metric names and units across records. Season types default to `Regular Season`; use a different value for playoffs or other competitions. Only completed regular-season games with both scores and without a shootout contribute to calculated standings. Analytics use the requested phase and the same score exclusions. Those tables use 3 points for a win and 1 for a draw; their display order is not official MLS playoff seeding.

Available pages: overview, teams and team profiles, players and player profiles, schedule and match details, standings, team stats, player stats, compare, and analytics. Partial imports work: teams can be visible while statistics remain unavailable. Comparisons display imported season aggregates side by side.

## Backend API

The backend uses `MlsDataService`, registered as a singleton, and a league-specific exception filter, following the MLB and NHL structure. It validates imported identities, references, dates, finite numeric metrics, and duplicate rows before serving data. Date-only values and ISO timestamps are accepted; timestamps are preserved as `startTime` and `date` is normalized to the UTC calendar date. Invalid files return a controlled 503 and log the cause. Cancellation propagates to file reads.

All routes start with `/api/leagues/mls`. Optional `season` defaults to the latest imported year. IDs use the exact imported string, URL-encoded when necessary.

| Route | Behavior / filters |
| --- | --- |
| `GET /season` | Existing page-compatible `{ seasons, data }` envelope. No import or an unimported season returns `data: null`. |
| `GET /seasons` | Imported years as descending strings; empty list before import. |
| `GET /coverage` | Counts for entities, matches, missing scores, shootouts, and observed stat rows. |
| `GET /teams` | Team list; optional `search`, `conference`. |
| `GET /teams/{id}` | Team profile, home/away records, current roster, imported statistics; `seasonType`. |
| `GET /players` | Paginated players; `search`, `teamId` (current or observed historical club), `position`. |
| `GET /players/{id}` | Profile, observed clubs, imported statistics; `seasonType`. |
| `GET /players/{id}/games` | Paginated actual imported player match observations; `seasonType`. |
| `GET /games` | Paginated matches; `teamId`, `date=YYYY-MM-DD`, `status=completed\|scheduled\|not-final`, `seasonType`. |
| `GET /games/{id}` | Match details. |
| `GET /games/{id}/statistics` | Match statistics, or `available: false` with empty arrays when not imported. |
| `GET /standings` | Calculated regular-season records, coverage, and method. |
| `GET /analytics` | Team records, home/away splits, and imported aggregates; `seasonType`. |
| `GET /statistics` | Ranked imported aggregates; `kind=player\|team`, `metric` (default `goals`), `sort=asc\|desc`, `minGames`, `search`, `seasonType`. Team-kind rows also accept `teamId`. |
| `GET /compare` | `leftId`, `rightId`, optional `leftSeason`, `rightSeason`, `kind=player\|team`, `seasonType`; includes metric differences as left minus right. |

Paginated routes accept `page` (1–1,000,000) and `pageSize` (1–100, default 40). Their results contain `items`, `total`, `page`, and `pageSize`; player match logs and statistics nest this under `results`. Invalid filters return 400; unimported seasons and unknown entities return 404; unavailable or invalid storage returns 503. `/season` keeps its empty-state compatibility behavior. Phase values are `Regular Season`, `Playoffs`, `Preseason`, `Exhibition`, and `All-Star`.

Statistics rank only imported observations. Null/missing metrics sort last and have no rank. Equal values share a competition rank; search preserves ranks. Minimum-games filters exclude rows without an observed games count. Player season totals cannot be filtered to one team because traded-player contributions are not split in the current files; that request returns 400. No player appearances are inferred from rosters.

### Optional extended fields

- Players can include `observedTeamIds: ["team-a", "team-b"]` to preserve transfer history alongside their current `teamId`.
- Matches can include `shootout: true`. Such matches are excluded from calculated records because the file does not identify regulation scores separately. Coverage reports the exclusions.
- Each season aggregate can include `seasonType` (defaults to `Regular Season`). There may be one aggregate per entity **and phase**. Rates and percentages are served as imported; they are not summed or averaged by the backend.
- `gameTeamStats` and `gamePlayerStats` are optional season-level arrays. Each row has `gameId`, `teamId`, `statistics`, and, for player rows, `playerId`. References must exist, matches must be completed, and a team must be one of the match participants. Example:

```json
{
  "gameTeamStats": [
    { "gameId": "match-a", "teamId": "team-a", "statistics": { "shots": 12, "possessionPercentage": 54.2 } }
  ],
  "gamePlayerStats": [
    { "gameId": "match-a", "teamId": "team-a", "playerId": "player-a", "statistics": { "goals": 1, "minutes": 90 } }
  ]
}
```

Without these match observations, match statistics and player logs stay empty, even if season aggregates are present. Partial coverage is explicitly reported; a structurally valid file does not imply complete sporting coverage.

## Verification

Run `dotnet run --project verification/MlsChecks` from the repository root. This checks empty storage, live import/replacement, timestamp normalization, soccer records, missing observations, shootouts, filters, pagination, profiles, comparisons, validation failures, and the existing local MLS imports when present.

For read-only HTTP checks against a running backend with at least one imported season, run:

```sh
GAMEPULSE_API_BASE_URL=http://localhost:5241 python3 verification/mls/check_api.py
```
