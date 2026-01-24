"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export function DetailsSection() {
  return (
    <section className="w-full container mx-auto max-w-7xl px-4 md:px-6 pb-20">
      <div className="w-full rounded-2xl border border-border/60 bg-card shadow-xl p-4 sm:p-6 md:p-8">
        <Tabs defaultValue="details" className="w-full">
        <TabsList className="bg-transparent p-0 justify-start h-auto border-b w-full rounded-none mb-6 overflow-x-auto">
          <TabsTrigger
            value="details"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
          >
            Sale Details
          </TabsTrigger>
          <TabsTrigger
            value="how-it-works"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
          >
            How the Sale Works
          </TabsTrigger>
          <TabsTrigger
            value="token"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
          >
            Token Overview
          </TabsTrigger>
          <TabsTrigger
            value="project"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
          >
            Project Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
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
                    <span className="font-medium">100,000,000 ACME</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">
                      Tokens for sale
                    </span>
                    <span className="font-medium">10,000,000 (10%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Allocation</h3>
                <div className="flex items-center justify-center h-[200px] bg-muted/20 rounded-md text-muted-foreground">
                  Allocation Chart Placeholder
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent
          value="how-it-works"
          className="min-h-[200px] text-muted-foreground"
        >
          Content for 'How the Sale Works'
        </TabsContent>
        <TabsContent
          value="token"
          className="min-h-[200px] text-muted-foreground"
        >
          Content for 'Token Overview'
        </TabsContent>
        <TabsContent
          value="project"
          className="min-h-[200px] text-muted-foreground"
        >
          Content for 'Project Details'
        </TabsContent>
      </Tabs>
      </div>
    </section>
  );
}
