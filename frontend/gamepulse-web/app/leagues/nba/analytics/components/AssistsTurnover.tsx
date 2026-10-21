"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { TeamStats } from "@/lib/api";

type PointsAssistsScatterProps = {
  teamStats: TeamStats[];
};

export default function AssistsTurnover({
  teamStats,
}: PointsAssistsScatterProps) {
  const data = teamStats.map((team) => ({
    name: team.name,
    abbreviation: team.abbreviation,
    conference: team.conference,
    turnoversPerGame: team.turnoversPerGame,
    assistsPerGame: team.assistsPerGame,
  }));

    return (
    <section className="mt-10 w-full min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <div>
        <h2 className="text-2xl font-bold">Turnovers vs Assists</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Each dot represents a team. The X-axis shows average turnovers per game,
          while the Y-axis shows average assists per game.
        </p>
        <p className="mt-1 text-xs text-blue-300">
            Best area: upper-left — more assists with fewer turnovers.
        </p>
      </div>

      <div className="mt-6 h-105 w-full min-w-0">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 10 }}>
            <CartesianGrid
              stroke="#334155"
              strokeDasharray="3 3"
            />

            <XAxis
              type="number"
              dataKey="turnoversPerGame"
              name="Turnovers Per Game"
              domain={[10, 18]}
              tickCount={6}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={false}
              label={{
                value: "Turnovers Per Game",
                position: "insideBottom",
                offset: -15,
                fill: "#94a3b8",
                fontSize: 12,
              }}
            />

            <YAxis
              type="number"
              dataKey="assistsPerGame"
              name="Assists Per Game"
              domain={[20, 35]}
              tickCount={8}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={false}
              label={{
                value: "Assists Per Game",
                angle: -90,
                position: "insideLeft",
                fill: "#94a3b8",
                fontSize: 12,
              }}
            />

            <ZAxis range={[80, 80]} />

            <Tooltip
              cursor={{ stroke: "#60a5fa", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const team = payload[0].payload;

                return (
                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl">
                    <p className="font-bold text-white">{team.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {team.abbreviation} · {team.conference}
                    </p>
                    <p className="mt-3 text-sm text-blue-300">
                      TPG: {team.turnoversPerGame.toFixed(1)}
                    </p>
                    <p className="text-sm text-blue-300">
                      APG: {team.assistsPerGame.toFixed(1)}
                    </p>
                  </div>
                );
              }}
            />

            <Scatter
              name="Teams"
              data={data}
              fill="#60a5fa"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};