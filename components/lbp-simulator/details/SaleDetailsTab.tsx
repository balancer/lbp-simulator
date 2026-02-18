"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useSimulatorStore } from "@/store/useSimulatorStore";
import { useShallow } from "zustand/react/shallow";
import { formatNumber } from "@/lib/utils";

function SaleDetailsTabComponent() {
  const { config } = useSimulatorStore(
    useShallow((state) => ({
      config: state.config,
    })),
  );

  // Calculate tokens for sale
  const tokensForSale = config.tknBalanceIn;
  const percentForSale = (tokensForSale / config.totalSupply) * 100;

  return (
    <div className="max-w-md">
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
              <span className="font-medium">
                {config.duration >= 24
                  ? `${(config.duration / 24).toFixed(1)} days`
                  : `${config.duration} hours`}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Token Name</span>
              <span className="font-medium">{config.tokenName}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SaleDetailsTabComponent;
