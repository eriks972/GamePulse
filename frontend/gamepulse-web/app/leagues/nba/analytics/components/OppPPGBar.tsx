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

type OppPPGChartProps = {
  teamStats: TeamStats[];
};

export default function OppPPGChart({ teamStats }: OppPPGChartProps) {
  const chartData = [...teamStats]
    .sort((a, b) => a.opponentPointsPerGame - b.opponentPointsPerGame)
    .slice(0, 10)
    .map((team) => ({
      team: team.abbreviation,
      fullName: team.name,
      opponentPointsPerGame: team.opponentPointsPerGame,
      pointsPerGame: team.pointsPerGame,
      scoringMargin: team.scoringMargin,
    }));

  return (
    <section className="mt-10 w-full min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <div>
        <h2 className="text-2xl font-bold">
          Best Defensive Teams by Opponent Points Per Game
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          This chart shows the average points scored by each team&apos;s
          opponents. Lower is better.
        </p>
      </div>

      <div className="mt-6 h-90 w-full min-w-0">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <CartesianGrid
              stroke="#334155"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="team"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[100, 115]}
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
                      Opp PPG: {data.opponentPointsPerGame.toFixed(1)}
                    </p>

                    <p className="text-sm text-slate-400">
                      PPG: {data.pointsPerGame.toFixed(1)}
                    </p>

                    <p className="text-sm text-slate-400">
                      Margin: {data.scoringMargin > 0 ? "+" : ""}
                      {data.scoringMargin.toFixed(1)}
                    </p>
                  </div>
                );
              }}
            />

            <Bar
              dataKey="opponentPointsPerGame"
              fill="#60a5fa"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}