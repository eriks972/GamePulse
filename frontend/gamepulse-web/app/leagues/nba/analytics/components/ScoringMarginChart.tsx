"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamStats } from "@/lib/api";

type ScoringMarginChartProps = {
  teamStats: TeamStats[];
};

export default function ScoringMarginChart({
  teamStats,
}: ScoringMarginChartProps) {
  const chartData = [...teamStats]
    .sort((a, b) => b.scoringMargin - a.scoringMargin)
    .slice(0, 10)
    .map((team) => ({
      team: team.abbreviation,
      fullName: team.name,
      margin: team.scoringMargin,
      pointsPerGame: team.pointsPerGame,
      opponentPointsPerGame: team.opponentPointsPerGame,
    }));

  return (
    <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <div>
        <h2 className="text-2xl font-bold">Top Teams by Scoring Margin</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Scoring margin shows the average point difference between a team and
          its opponents. Higher is better.
        </p>
      </div>

      <div className="mt-6 h-90px">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData}  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="team"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const data = payload[0].payload;

                return (
                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl">
                    <p className="font-bold text-white">{data.fullName}</p>
                    <p className="mt-2 text-sm text-blue-300">
                      Margin: {data.margin > 0 ? "+" : ""}
                      {data.margin.toFixed(1)}
                    </p>
                    <p className="text-sm text-slate-400">
                      PPG: {data.pointsPerGame.toFixed(1)}
                    </p>
                    <p className="text-sm text-slate-400">
                      Opp PPG: {data.opponentPointsPerGame.toFixed(1)}
                    </p>
                  </div>
                );
              }}
            />

            <Bar
              dataKey="margin"
              radius={[8, 8, 0, 0]}
              fill="#3b82f6"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}