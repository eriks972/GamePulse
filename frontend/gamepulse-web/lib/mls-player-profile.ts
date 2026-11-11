import type { MlsPlayer, MlsSeason, MlsStat } from "./mls";

// Route segments can retain percent-encoded colons in Next.js. Stored IDs are
// source-qualified strings; never shorten them or guess a cross-source ID.
export function normalizeMlsRouteId(id?: string): string | undefined {
  if (!id) return undefined;
  try { return decodeURIComponent(id); } catch { return id; }
}

export function playerSeasonStats(data: MlsSeason, id: string, phase: string): MlsStat | undefined {
  return data.playerStats.find(row => row.id === id && (row.seasonType || "Regular Season") === phase);
}

export function playerHasStatistics(data: MlsSeason, id: string, phase = "Regular Season"): boolean {
  const row = playerSeasonStats(data, id, phase);
  return !!row && Object.values(row.statistics).some(n => n !== null && Number.isFinite(n));
}

export function playerMetricItems(player: MlsPlayer, row?: MlsStat) {
  const s = row?.statistics ?? {};
  const goalkeeper = /^(g|gk|goalkeeper)$/i.test(player.position?.trim() || "") || s.saves != null;
  const keys = goalkeeper
    ? [["games", "Games with statistics"], ["saves", "Saves"], ["goalsAgainst", "Goals conceded"], ["cleanSheets", "Clean sheets"], ["minutes", "Minutes"], ["yellowCards", "Yellow cards"]]
    : [["games", "Games with statistics"], ["goals", "Goals"], ["assists", "Assists"], ["shots", "Shots"], ["shotsOnTarget", "Shots on target"], ["yellowCards", "Yellow cards"]];
  return keys.map(([key, label]) => ({ label, value: s[key] == null || !Number.isFinite(s[key]) ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(s[key]!) }));
}

export function statisticLabel(key: string): string {
  return ({ games: "Games with statistics", goalsAgainst: "Goals conceded", shotsOnTarget: "Shots on target", savePercentage: "Save percentage" } as Record<string, string>)[key]
    || key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
}
