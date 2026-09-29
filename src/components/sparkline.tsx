"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({
  data,
  width = 100,
  height = 30,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const chartData = data.map((v) => ({ v }));
  const isUp = data.length >= 2 && data[data.length - 1] >= data[0];

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isUp ? "#22c55e" : "#ef4444"}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
