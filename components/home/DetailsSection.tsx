"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HowItWorksTab } from "./details/HowItWorksTab";
import SaleDetailsTabComponent from "./details/SaleDetailsTab";

export function DetailsSection() {
  return (
    <section className="w-full container mx-auto max-w-7xl px-4 md:px-6 pb-20">
      <div className="w-full rounded-2xl border border-border/60 bg-card shadow-xl p-4 sm:p-6 md:p-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="bg-transparent justify-start h-auto border-b w-full rounded-none mb-6 overflow-x-auto">
            <TabsTrigger
              value="details"
              className="rounded-none border-b-2 border-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
            >
              Sale Details
            </TabsTrigger>
            <TabsTrigger
              value="how-it-works"
              className="rounded-none border-b-2 border-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-3 text-sm sm:text-base whitespace-nowrap"
            >
              How the LBP Works
            </TabsTrigger>
          </TabsList>

          <TabsContent value="how-it-works">
            <HowItWorksTab />
          </TabsContent>
          <TabsContent value="details">
            <SaleDetailsTabComponent />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
