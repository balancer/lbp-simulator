"use client";

import { HowItWorksTab } from "./details/HowItWorksTab";

export function DetailsSection() {
  return (
    <section className="w-full container mx-auto max-w-7xl px-4 md:px-6 pb-20">
      <div className="w-full rounded-2xl border border-border/60 bg-card shadow-xl p-4 sm:p-6 md:p-8">
        <HowItWorksTab />
      </div>
    </section>
  );
}
