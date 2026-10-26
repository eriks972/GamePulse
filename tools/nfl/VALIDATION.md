# Validation — October 26, 2026

Live nflverse downloads were used for both seasons. Each season was then rebuilt from its local raw cache using the final collector.

| Season | Scheduled games | Scored games | Teams | Player identities | Player stat rows | Team stat rows | Missing completed team-games | Compressed bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 | 285 | 285 | 32 | 3133 | 19400 | 570 | 0 | 1,796,891 |
| 2026 | 272 | 106 | 32 | 3053 | 7370 | 212 | 0 | 787,596 |

The 2026 snapshot is an in-progress season, not a completed-season dataset. Snapshot collection timestamps and source hashes are in each manifest.

Fourteen offline tests passed: postseason season identity and timezone conversion; tie records and phase separation; null/zero/fractional defensive stats; unassigned player-source rows; unplayed games; duplicate identifiers; failed refresh preservation; interrupted publication preservation; explicit partial coverage; valid compressed output counts; unmatched schedule joins; team aliases and traded identities; offline missing-cache behavior; and single-writer locking.

All 16 delivered dataset files were decompressed, parsed, checked against their manifest counts and season, and verified against their SHA-256 hashes. These checks validate ingestion and packaging; they do not certify every upstream statistic against official NFL records.

Not tested or implemented here: C# integration, Next.js integration, Render/Vercel deployment, live game state, official standings tiebreakers, or the entire historical backfill range. No current GamePulse source was available.

Raw caches, Python environments, and superseded runs are excluded from the ZIP.
