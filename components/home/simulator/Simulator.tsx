"use client";

import React, { memo, useCallback, startTransition } from "react";

import { SimulatorHeader } from "./SimulatorHeader";
import { SimulatorStats } from "./SimulatorStats";
import { SimulatorMain } from "./SimulatorMain";
import { SimulatorConfig } from "./SimulatorConfig";
import { SwapForm } from "./SwapForm";

import { useSimulatorStore } from "@/store/useSimulatorStore";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const CONFIG_MAX_HEIGHT = "70vh";

/** Config overlay: sits on top of header + stats when open; animates open/close. */
const ConfigOverlay = memo(function ConfigOverlay() {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {open && (
        <button
          type="button"
          className="absolute inset-0 z-[9] cursor-default bg-red"
          onClick={() => setOpen(false)}
          aria-label="Close config"
        />
      )}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-10 overflow-hidden rounded-t-xl border-b border-border/60 bg-card shadow-lg transition-[max-height,opacity] duration-300 ease-out",
          open
            ? "max-h-[var(--config-overlay-max)] opacity-100"
            : "max-h-0 opacity-0 pointer-events-none border-transparent",
        )}
        style={
          { "--config-overlay-max": CONFIG_MAX_HEIGHT } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()} // 👈 IMPORTANT
      >
        <div className="overflow-auto max-h-[70vh]">
          <SimulatorConfig />
        </div>
      </div>
    </>
  );
});

const SimulatorContent = memo(function SimulatorContent() {
  const { setOpen, open } = useSidebar();

  return (
    <div
      onClick={() => {
        if (open) setOpen(false);
      }}
      className="
    min-w-0 flex-1
    rounded-b-2xl
    border border-border/60 border-t-0
    bg-card shadow-xl
    shadow-xl
    p-4 sm:p-6 md:p-8
    overflow-hidden
  "
    >
      <div className="relative">
        <SimulatorHeader />
        <SimulatorStats />
        <ConfigOverlay />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SimulatorMain />
        </div>
        <div className="lg:col-span-1 flex">
          <SwapForm />
        </div>
      </div>
    </div>
  );
});

export function Simulator() {
  const isConfigOpen = useSimulatorStore((state) => state.isConfigOpen);
  const setIsConfigOpen = useSimulatorStore((state) => state.setIsConfigOpen);

  const onOpenChange = useCallback(
    (open: boolean) => {
      startTransition(() => {
        setIsConfigOpen(open);
      });
      if (open) {
        document.getElementById("lbp-settings")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    },
    [setIsConfigOpen],
  );

  return (
    <section
      id="lbp-settings"
      className="flex w-full flex-col container mx-auto max-w-[1800px] px-4 md:px-6 pb-20 gap-0 min-h-0"
    >
      <SidebarProvider
        open={isConfigOpen}
        onOpenChange={onOpenChange}
        className="w-full flex flex-col"
      >
        {/* Trigger bar: always visible */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-card px-2 py-2 rounded-t-2xl">
          <SidebarTrigger className="flex" aria-label="Toggle config panel" />
          <span className="text-sm text-muted-foreground">Config</span>
        </div>

        {/* Simulator: config overlays header+stats when open; chart always visible */}
        <SimulatorContent />
      </SidebarProvider>
    </section>
  );
}
