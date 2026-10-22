import type { WnbaComparison, WnbaComparisonTeam } from "./wnba";

export type ComparisonBasis = "perGame" | "total";
export type ComparisonValue = { value: number | null; games: number; completed: number };
export type ComparisonRow = {
  key: string; label: string; percentage: boolean; lowerIsBetter: boolean;
  a: ComparisonValue; b: ComparisonValue; highlightAllowed: boolean; advantage: "a" | "b" | null;
};

export function comparisonRows(data: WnbaComparison, basis: ComparisonBasis): ComparisonRow[] {
  const specs = [
    ["points", basis === "total" ? "Points" : "Points / game", false, false],
    ["opponentPoints", basis === "total" ? "Opponent points" : "Opponent points / game", false, true],
    ["margin", basis === "total" ? "Schedule point differential" : "Schedule scoring margin / game", false, false],
    ["rebounds", "Rebounds", false, false], ["assists", "Assists", false, false],
    ["turnovers", "Turnovers", false, true], ["steals", "Steals", false, false], ["blocks", "Blocks", false, false],
    ["fieldGoals", "Field goals", true, false], ["threePointers", "Three-pointers", true, false], ["freeThrows", "Free throws", true, false],
  ] as const;
  return specs.map(([key, label, percentage, lowerIsBetter]) => {
    const read = (side: WnbaComparisonTeam): ComparisonValue => {
      const stats = side.seasonStatistics;
      if (key === "margin") return { value: basis === "total" ? side.record.pointDifferential : side.record.scoringMargin,
        games: side.record.games, completed: side.record.completedGames };
      if (percentage) return { value: stats.shooting[key].percentage, games: stats.shooting[key].games, completed: stats.completedGames };
      const metric = key === "opponentPoints" ? stats.opponentStatistics.points : stats.statistics[key];
      return { value: metric[basis], games: metric.games, completed: stats.completedGames };
    };
    const a = read(data.teamA), b = read(data.teamB);
    const highlightAllowed = a.value != null && b.value != null && Number.isFinite(a.value) && Number.isFinite(b.value) &&
      a.games > 0 && b.games > 0 && a.games === a.completed && b.games === b.completed &&
      (basis === "perGame" || percentage || a.games === b.games);
    const advantage = !highlightAllowed || a.value === b.value ? null :
      ((lowerIsBetter ? a.value! < b.value! : a.value! > b.value!) ? "a" : "b");
    return { key, label, percentage, lowerIsBetter, a, b, highlightAllowed, advantage };
  });
}
