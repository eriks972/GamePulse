"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TeamStats } from "@/lib/api";

type ShootingEfficiencyChartProps = {
  teamStats: TeamStats[];
};

export default function ShootingEfficiencyChart({
  teamStats,
}: ShootingEfficiencyChartProps) {
  const chartData = [...teamStats]
    .sort((a, b) => b.fieldGoalPercentage - a.fieldGoalPercentage)
    .slice(0, 10)
    .map((team) => ({
      team: team.abbreviation,
      fullName: team.name,
      fieldGoalPercentage: Number((team.fieldGoalPercentage * 100).toFixed(1)),
      threePointPercentage: Number((team.threePointPercentage * 100).toFixed(1)),
      freeThrowPercentage: Number((team.freeThrowPercentage * 100).toFixed(1)),
    }));

  return (
    <section className="mt-10 w-full min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <div>
        <h2 className="text-2xl font-bold">Shooting Efficiency Comparison</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Compare the top teams by field goal percentage across FG%, 3PT%, and FT%.
        </p>
      </div>

      <div className="mt-6 h-105 w-full min-w-0">
        <ResponsiveContainer width="100%" height={420}>
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
              domain={[25, 85]}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />

            <Tooltip
              cursor={{ fill: "rgba(96, 165, 250, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const data = payload[0].payload;

                return (
                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl">
                    <p className="font-bold text-white">{data.fullName}</p>

                    <p className="mt-2 text-sm text-blue-300">
                      FG%: {data.fieldGoalPercentage.toFixed(1)}%
                    </p>

                    <p className="text-sm text-slate-400">
                      3PT%: {data.threePointPercentage.toFixed(1)}%
                    </p>

                    <p className="text-sm text-slate-400">
                      FT%: {data.freeThrowPercentage.toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{
                color: "#94a3b8",
                fontSize: "12px",
                paddingTop: "12px",
              }}
            />

            <Bar
              dataKey="fieldGoalPercentage"
              name="FG%"
              fill="#60a5fa"
              radius={[6, 6, 0, 0]}
            />

            <Bar
              dataKey="threePointPercentage"
              name="3PT%"
              fill="#38bdf8"
              radius={[6, 6, 0, 0]}
            />

            <Bar
              dataKey="freeThrowPercentage"
              name="FT%"
              fill="#34d399"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}