"use client";

import {
  AreaChart,
  Area,
  Line,
  ResponsiveContainer,
  YAxis,
} from "recharts";

const HORIZON_ORDER = ["d1", "w1", "m1", "m3", "m6", "y1"];

export function FanChart({
  price0,
  horizons,
  width = 160,
  height = 60,
}: {
  price0: number;
  horizons: Record<string, { bear: number; base: number; bull: number }>;
  width?: number;
  height?: number;
}) {
  const data = [
    { name: "now", bear: price0, base: price0, bull: price0 },
  ];

  for (const h of HORIZON_ORDER) {
    const proj = horizons[h];
    if (proj) {
      data.push({
        name: h,
        bear: proj.bear,
        base: proj.base,
        bull: proj.bull,
      });
    }
  }

  if (data.length < 2) return null;

  const allValues = data.flatMap((d) => [d.bear, d.bull]);
  const yMin = Math.min(...allValues) * 0.98;
  const yMax = Math.max(...allValues) * 1.02;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <YAxis domain={[yMin, yMax]} hide />
          <Area
            type="monotone"
            dataKey="bull"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="bear"
            stroke="none"
            fill="#ef4444"
            fillOpacity={0.15}
          />
          <Line
            type="monotone"
            dataKey="base"
            stroke="currentColor"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
