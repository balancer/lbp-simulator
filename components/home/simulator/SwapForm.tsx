"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwapFormSwapTab } from "./SwapFormSwapTab";
import { SwapFormLimitTab } from "./SwapFormLimitTab";

export function SwapForm() {
  return (
    <Card className="h-[600px] border-border/60 shadow-sm">
      <Tabs defaultValue="swap" className="w-full h-full flex flex-col">
        <CardHeader className="pb-4">
          <TabsList variant="line">
            <TabsTrigger value="swap">Swap</TabsTrigger>
            <TabsTrigger value="limit">Limit</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <TabsContent value="swap" className="mt-0 h-full">
            <SwapFormSwapTab />
          </TabsContent>
          <TabsContent value="limit" className="mt-0 h-full">
            <SwapFormLimitTab />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

