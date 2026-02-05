"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/lbp-simulator/Hero";
import UseCases from "@/components/layout/UseCases";
import { Live } from "@/components/layout/Live";
import { Insights } from "@/components/layout/Insights";
import { KPI } from "@/components/layout/KPI";
import { CommomQuestions } from "@/components/layout/CommomQuestions";
import { Chains } from "@/components/layout/Chains";

export default function Home() {
  const [activeUseCase, setActiveUseCase] = useState(0);
  const searchParams = useSearchParams();
  const caseParam = searchParams.get("case");

  useEffect(() => {
    if (!caseParam) return;
    const index = ["buy-back", "token-launches", "divestment"].indexOf(
      caseParam,
    );
    if (index >= 0) {
      setActiveUseCase(index);
    }
  }, [caseParam]);

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans z-0">
      <main className="flex-1 w-full md:px-20 sm:px-10 px-0">
        <Hero />
        <Live />
        <KPI />
        <UseCases
          activeIndex={activeUseCase}
          onSelect={(index) => setActiveUseCase(index)}
          openCaseSlug={caseParam}
        />
        <Insights activeIndex={activeUseCase} />
        <Chains />
        <CommomQuestions />
      </main>
      <Footer />
    </div>
  );
}
