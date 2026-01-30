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

interface WeightsChartTabProps {
  chartData: any[];
  shouldAnimate: boolean;
}

function WeightsChartTabComponent({ chartData, shouldAnimate }: WeightsChartTabProps) {
  const { resolvedTheme } = useTheme();
  const axisLabelColor = resolvedTheme === "dark" ? "#b3b3b3" : "#6b7280";

  return (
    <>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="tknWeightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#bfdbfe" /> {/* blue-200 */}
              <stop offset="50%" stopColor="#e9d5ff" /> {/* purple-200 */}
              <stop offset="100%" stopColor="#fed7aa" /> {/* orange-200 */}
            </linearGradient>
            <linearGradient id="usdcWeightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#bfdbfe" /> {/* blue-200 */}
              <stop offset="50%" stopColor="#e9d5ff" /> {/* purple-200 */}
              <stop offset="100%" stopColor="#fed7aa" /> {/* orange-200 */}
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.4}
          />
          <XAxis
            dataKey="timeLabel"
            stroke={axisLabelColor}
            fontSize={12}
            axisLine={false}
            tickLine={false}
            tick={{ fill: axisLabelColor }}
          />
          <YAxis
            domain={[0, 100]}
            stroke={axisLabelColor}
            fontSize={12}
            tickFormatter={(val) => `${val}%`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: axisLabelColor }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
            }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            labelStyle={{
              color: "hsl(var(--muted-foreground))",
              marginBottom: "0.25rem",
            }}
            formatter={(value: any, name: any) => [
              `${Number(value).toFixed(2)}%`,
              name === "tknWeight" ? "Token" : "USDC",
            ]}
          />
          <Line
            type="monotone"
            dataKey="tknWeight"
            stroke="url(#tknWeightGradient)"
            strokeWidth={3}
            dot={false}
            name="tknWeight"
            activeDot={{ r: 6, fill: "#e9d5ff" }}
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
          <Line
            type="monotone"
            dataKey="usdcWeight"
            stroke="url(#usdcWeightGradient)"
            strokeWidth={3}
            dot={false}
            name="usdcWeight"
            activeDot={{ r: 6, fill: "#fed7aa" }}
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200"></div>
          <span>Token</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200"></div>
          <span>USDC</span>
        </div>
      </div>
    </>
  );
}

export const WeightsChartTab = memo(WeightsChartTabComponent);
