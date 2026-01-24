"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function BidForm() {
  const [isAdvanced, setIsAdvanced] = useState(false);

  return (
    <Card className="h-full border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Place a bid</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Label htmlFor="mode-toggle" className="font-normal cursor-pointer">
              Simple
            </Label>
            <Switch
              id="mode-toggle"
              checked={isAdvanced}
              onCheckedChange={setIsAdvanced}
            />
            <Label htmlFor="mode-toggle" className="font-normal cursor-pointer">
              Advanced
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="budget">Total Budget</Label>
          <div className="relative">
            <Input
              id="budget"
              type="number"
              placeholder="0.00"
              className="pr-12"
            />
            <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
              USDC
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Balance: 12,450.00 USDC</span>
            <span className="text-indigo-600 cursor-pointer font-medium">
              Max
            </span>
          </div>
        </div>

        {isAdvanced && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Label htmlFor="max-price">Max Price (Limit)</Label>
            <div className="relative">
              <Input
                id="max-price"
                type="number"
                placeholder="0.00"
                className="pr-12"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                USDC
              </span>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
          className=" w-full inline-flex bg-gradient-to-r from-blue-200 via-purple-200 to-orange-200 hover:from-blue-300 hover:via-purple-300 hover:to-orange-300 text-slate-900 font-semibold rounded-xl px-6 h-11 items-center gap-2"
            size="lg"
          >
            Place Order
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            This transaction is simulated and will not cost real tokens.
          </p>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Your Active Orders</h4>
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md bg-muted/30">
            No active orders
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
