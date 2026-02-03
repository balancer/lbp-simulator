"use client";

import { memo } from "react";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";

interface SwapsTabProps {
  swaps: any[];
}

function SwapsTabComponent({ swaps }: SwapsTabProps) {
  const { config } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
    })),
  );

  return (
    <div className="relative overflow-x-auto max-h-[95%] w-full max-w-full">
      <div className="min-w-0 w-full h-full">
        <table className="w-full text-sm text-left min-w-[600px]">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/100 sticky top-0">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 min-w-[120px]">Account</th>
              <th className="px-4 py-3 text-right">Amount In</th>
              <th className="px-4 py-3 text-right">Amount Out</th>
              <th className="px-4 py-3 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {swaps.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No swaps yet. Start simulation.
                </td>
              </tr>
            ) : (
              swaps.map((swap) => {
                const isBuy = swap.direction === "buy";
                const inToken = isBuy ? "USDC" : config.tokenSymbol;
                const outToken = isBuy ? config.tokenSymbol : "USDC";

                return (
                  <tr
                    key={swap.id}
                    className="bg-background border-b hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {swap.time}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          isBuy
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                        }`}
                      >
                        {isBuy ? "Buy" : "Sell"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[120px] truncate">
                      {swap.account}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={isBuy ? "text-emerald-600" : ""}>
                        {swap.amountIn.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {inToken}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {swap.amountOut.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      {outToken}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                      ${swap.price.toFixed(4)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const SwapsTab = memo(SwapsTabComponent);
