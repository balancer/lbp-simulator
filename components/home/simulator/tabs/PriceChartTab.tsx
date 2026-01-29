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
  Legend,
} from "recharts";
import { memo, useMemo } from "react";

interface PriceChartTabProps {
  chartData: any[];
  isPlaying: boolean;
  shouldAnimate: boolean;
  simulationData: any[];
  currentStep: number;
}

function PriceChartTabComponent({
  chartData,
  isPlaying,
  shouldAnimate,
  simulationData,
  currentStep,
}: PriceChartTabProps) {
  const { resolvedTheme } = useTheme();
  const axisLabelColor = resolvedTheme === "dark" ? "#b3b3b3" : "#6b7280";

  const displayData = useMemo(() => {
    const step = currentStep ?? 0;

    return chartData.map((d) => {
      const idx = d.index ?? 0;

      const show = step === 0 ? true : idx <= step;

      return {
        ...d,
        price: show ? d.price : null,

        potentialPathLow: !isPlaying ? d.potentialPathLow : null,
        potentialPathMedium: !isPlaying ? d.potentialPathMedium : null,
        potentialPathHigh: !isPlaying ? d.potentialPathHigh : null,
      };
    });
  }, [chartData, currentStep, isPlaying]);

  return (
    <>
      <ResponsiveContainer width="100%" height="95%">
        <LineChart
          data={displayData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.4}
          />
          <XAxis
            dataKey="timeLabel"
            hide={true}
            axisLine={false}
            tickLine={false}
          />
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
            formatter={(value: any, name?: string) => {
              if (value == null) return "";
              const label = name || "Price";
              return [`$${Number(value).toFixed(4)}`, label];
            }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
              paddingBottom: "10px",
              fontSize: "12px",
            }}
            iconType="line"
            formatter={(value) => {
              const labels: Record<string, string> = {
                price: "Spot price",
                potentialPathLow: "Potential path (low demand)",
                potentialPathMedium: "Potential path (medium demand)",
                potentialPathHigh: "Potential path (high demand)",
              };
              return labels[value] || value;
            }}
          />
          {/* Potential price paths - only shown when simulation is paused */}
          {!isPlaying && (
            <>
              <Line
                type="monotone"
                dataKey="potentialPathLow"
                stroke="#9ca3af" // gray-400
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="potentialPathMedium"
                stroke="#6b7280" // gray-500
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="potentialPathHigh"
                stroke="#4b5563" // gray-600
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </>
          )}
          {/* Actual spot price - shown as solid line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="url(#demand-pressure-gradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "url(#demand-pressure-gradient)" }}
            isAnimationActive={shouldAnimate}
            animationDuration={shouldAnimate ? 300 : 0}
            name="price"
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export const PriceChartTab = memo(PriceChartTabComponent);
