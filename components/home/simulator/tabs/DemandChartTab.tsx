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

function DemandChartTabComponent({
  chartData,
  shouldAnimate,
}: DemandChartTabProps) {
  const { resolvedTheme } = useTheme();
  const axisLabelColor = resolvedTheme === "dark" ? "#b3b3b3" : "#6b7280";

  return (
    <>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 50 }}
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
            tickFormatter={(val) => `${val.toFixed(0)}`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: axisLabelColor }}
          />
          <Tooltip
            formatter={(value: any, name: any) => {
              const labelMap: Record<string, string> = {
                buyPressure: "Buy pressure (USDC/step)",
                sellPressure: "Sell pressure (USDC/step)",
                netPressure: "Net demand (buy - sell)",
              };
              return [
                `${Number(value).toFixed(0)}`,
                labelMap[name as string] ?? name,
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="buyPressure"
            stroke="#16a34a" // green-600
            strokeWidth={2}
            dot={false}
            name="buyPressure"
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
          <Line
            type="monotone"
            dataKey="sellPressure"
            stroke="#dc2626" // red-600
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="sellPressure"
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
          <Line
            type="monotone"
            dataKey="netPressure"
            stroke="#2563eb" // blue-600
            strokeWidth={3}
            dot={false}
            name="netPressure"
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-center mt-2 text-xs text-muted-foreground mt-0 ">
        Net demand curve = buy pressure − sell pressure (USDC per step). Above
        zero means net buying; below zero means net selling.
      </div>
    </>
  );
}

export const DemandChartTab = memo(DemandChartTabComponent);
