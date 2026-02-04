"use client";

import { useEffect } from "react";
import { DetailsSection } from "@/components/lbp-simulator/DetailsSection";
import { Simulator } from "@/components/lbp-simulator/simulator/Simulator";

const SimulatorPage = () => {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      const scrollRoot = document.getElementById("app-scroll");
      if (scrollRoot) {
        scrollRoot.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full">
      <Simulator />
      <DetailsSection />
    </div>
  );
};

export default SimulatorPage;
