"use client";

import { useState } from "react";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/lbp-simulator/Hero";
import UseCases from "@/components/layout/UseCases";
import { Live } from "@/components/layout/Live";
import { Insights } from "@/components/layout/Insights";
import { KPI } from "@/components/layout/KPI";
import { CommomQuestions } from "@/components/layout/CommomQuestions";

export default function Home() {
  const [activeUseCase, setActiveUseCase] = useState(1);

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans z-0">
      <main className="flex-1 w-full md:px-20 sm:px-10 px-0">
        <Hero />
        <Live />
        <KPI />
        <UseCases
          activeIndex={activeUseCase}
          onSelect={(index) => setActiveUseCase(index)}
        />
        <Insights activeIndex={activeUseCase} />
        <CommomQuestions />
      </main>
      <Footer />
    </div>
  );
}
