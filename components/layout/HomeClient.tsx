"use client";

import { useEffect, useState } from "react";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/lbp-simulator/Hero";
import UseCases from "@/components/layout/UseCases";
import { Live } from "@/components/layout/Live";
import { Insights } from "@/components/layout/Insights";
import { KPI } from "@/components/layout/KPI";
import { CommomQuestions } from "@/components/layout/CommomQuestions";
import { Chains } from "@/components/layout/Chains";

type HomeClientProps = {
  initialCase?: string | null;
};

export function HomeClient({ initialCase }: HomeClientProps) {
  const [activeUseCase, setActiveUseCase] = useState(0);

  useEffect(() => {
    if (!initialCase) return;
    const index = ["buy-back", "token-launches", "divestment"].indexOf(
      initialCase,
    );
    if (index >= 0) {
      setActiveUseCase(index);
    }
  }, [initialCase]);

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans z-0">
      <main className="flex-1 w-full md:px-20 sm:px-10 px-0">
        <Hero />
        <Live />
        <KPI />
        <UseCases
          activeIndex={activeUseCase}
          onSelect={(index) => setActiveUseCase(index)}
          openCaseSlug={initialCase}
        />
        <Insights activeIndex={activeUseCase} />
        <Chains />
        <CommomQuestions />
      </main>
      <Footer />
    </div>
  );
}
