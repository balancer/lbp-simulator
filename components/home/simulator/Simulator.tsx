import { SimulatorHeader } from "./SimulatorHeader";

import { SimulatorStats } from "./SimulatorStats";
import { SimulatorMain } from "./SimulatorMain";
import { SimulatorConfig } from "./SimulatorConfig";

export function Simulator() {
  return (
    <section className="w-full container mx-auto max-w-7xl px-4 md:px-6 pb-20">
      <SimulatorConfig />
      <div className="w-full rounded-2xl border border-border/60 bg-card shadow-xl p-4 sm:p-6 md:p-8">
        <SimulatorHeader />
        <SimulatorStats />
        <SimulatorMain />
      </div>
    </section>
  );
}
