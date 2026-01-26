"use client";

import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { memo } from "react";

interface DemandChartTabProps {
  chartData: any[];
  shouldAnimate: boolean;
}

function DemandChartTabComponent({ chartData, shouldAnimate }: DemandChartTabProps) {
  const { resolvedTheme } = useTheme();
  const axisLabelColor = resolvedTheme === "dark" ? "#b3b3b3" : "#6b7280";

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.4}
          />
          <XAxis dataKey="timeLabel" hide={true} />
          <YAxis
            domain={["auto", "auto"]}
            stroke={axisLabelColor}
            fontSize={12}
            tickFormatter={(val) => `$${val.toFixed(2)}`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: axisLabelColor }}
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              `$${Number(value).toFixed(4)}`,
              name === "price" ? "Actual Price" : "Fair Value",
            ]}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#4f46e5"
            strokeWidth={2}
            dot={false}
            name="price"
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
          <Line
            type="monotone"
            dataKey="fairValue"
            stroke="#10b981" // emerald
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="fairValue"
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-center mt-2 text-xs text-muted-foreground">
        Green dotted line represents Market "Fair Value". If Price
        (Blue) drops below, Bots buy.
      </div>
    </>
  );
}

export const DemandChartTab = memo(DemandChartTabComponent);
