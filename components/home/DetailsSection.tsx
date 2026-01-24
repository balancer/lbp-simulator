"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaleDetailsTab } from "./details/SaleDetailsTab";
import { HowItWorksTab } from "./details/HowItWorksTab";
import { TokenOverviewTab } from "./details/TokenOverviewTab";
import { ProjectDetailsTab } from "./details/ProjectDetailsTab";

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
          <SaleDetailsTab />
        </TabsContent>
        <TabsContent value="how-it-works">
          <HowItWorksTab />
        </TabsContent>
        <TabsContent value="token">
          <TokenOverviewTab />
        </TabsContent>
        <TabsContent value="project">
          <ProjectDetailsTab />
        </TabsContent>
      </Tabs>
      </div>
    </section>
  );
}
