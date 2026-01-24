"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export function SaleDetailsTab() {
  const { config } = useSimulatorStore();

  // Calculate tokens for sale
  const tokensForSale = config.tknBalanceIn;
  const percentForSale = (tokensForSale / config.totalSupply) * 100;

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Donut chart data for fee allocation
  const BALANCER_FEE = 10; // Always 10%
  const creatorFee = config.creatorFee || 5;
  const remainingFee = 100 - BALANCER_FEE - creatorFee;

  const donutData = [
    { name: "Balancer Fee", value: BALANCER_FEE },
    { name: "Creator Fee", value: creatorFee },
    { name: "Remaining", value: remainingFee },
  ];

  // Orange and purple colors from the project gradient
  const COLORS = ["#e9d5ff", "#fed7aa", "#6b7280"]; // purple-200, orange-200, gray

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sale Parameters</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Auction type</span>
              <span className="font-medium">Batch Auction</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Goal</span>
              <span className="font-medium">Fair price discovery</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="font-medium">
                {formatNumber(config.totalSupply)} {config.tokenSymbol}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">
                Tokens for sale
              </span>
              <span className="font-medium">
                {formatNumber(tokensForSale)} ({percentForSale.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{config.duration} hours</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Token Name</span>
              <span className="font-medium">{config.tokenName}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Fee Allocation</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  innerRadius={40}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => `${value}%`}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
