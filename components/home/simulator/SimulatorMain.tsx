"use client";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BidForm } from "./BidForm";
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

export function SimulatorMain() {
  const { simulationData, bids, demandCurve } = useSimulatorStore();
  const { resolvedTheme } = useTheme();
  
  // Get theme-aware colors for axis labels
  const axisLabelColor = resolvedTheme === "dark" ? "#b3b3b3" : "#6b7280"; // muted-foreground equivalent

  const demandChartData = simulationData.map((d, i) => ({
    ...d,
    fairValue: demandCurve[i],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Tabs defaultValue="chart" className="w-full">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-transparent p-0 justify-start h-auto border-b w-full rounded-none">
              <TabsTrigger
                value="chart"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-4 py-2"
              >
                Price chart
              </TabsTrigger>
              <TabsTrigger
                value="bids"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-4 py-2"
              >
                Bids
              </TabsTrigger>
              <TabsTrigger
                value="demand"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-4 py-2"
              >
                Fair price discovery
              </TabsTrigger>
              <TabsTrigger
                value="weights"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-4 py-2"
              >
                Weights
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-[400px] border rounded-md bg-background/50 p-4 relative">
            <TabsContent value="chart" className="mt-0 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={simulationData}
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
                    formatter={(value: any) => [
                      `$${Number(value).toFixed(4)}`,
                      "Price",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#4f46e5" // indigo-600
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: "#4f46e5" }}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="absolute bottom-2 right-4 text-xs text-muted-foreground font-mono">
                Steps: {simulationData.length} | Price: $
                {simulationData[simulationData.length - 1]?.price.toFixed(4)}
              </div>
            </TabsContent>

            <TabsContent value="bids" className="mt-0 h-full">
              <div className="relative overflow-x-auto h-[400px]">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right">In (USDC)</th>
                      <th className="px-4 py-3 text-right">Out (TKN)</th>
                      <th className="px-4 py-3 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No bids yet. Start simulation.
                        </td>
                      </tr>
                    ) : (
                      bids.map((bid, i) => (
                        <tr
                          key={bid.timestamp + i}
                          className="bg-background border-b hover:bg-muted/50"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {bid.time}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {bid.account}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {bid.amountIn.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {bid.amountOut.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            ${bid.price.toFixed(4)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="demand" className="mt-0 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={demandChartData}
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
                  />
                  <Line
                    type="monotone"
                    dataKey="fairValue"
                    stroke="#10b981" // emerald
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="fairValue"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="text-center mt-2 text-xs text-muted-foreground">
                Green dotted line represents Market "Fair Value". If Price
                (Blue) drops below, Bots buy.
              </div>
            </TabsContent>

            <TabsContent value="weights" className="mt-0 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={simulationData}
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
                      name === "tknWeight" ? "Token Weight" : "USDC Weight",
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
                    animationDuration={300}
                  />
                  <Line
                    type="monotone"
                    dataKey="usdcWeight"
                    stroke="url(#usdcWeightGradient)"
                    strokeWidth={3}
                    dot={false}
                    name="usdcWeight"
                    activeDot={{ r: 6, fill: "#fed7aa" }}
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200"></div>
                  <span>Token Weight</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200"></div>
                  <span>USDC Weight</span>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="lg:col-span-1">
        <BidForm />
      </div>
    </div>
  );
}
