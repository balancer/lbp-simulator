'use client';

import React, { memo, useCallback, startTransition } from 'react';

import { SimulatorHeader } from './SimulatorHeader';
import { SimulatorStats } from './SimulatorStats';
import { SimulatorConfig } from './SimulatorConfig';
import { SwapForm } from './SwapForm';

import { useSimulatorStore } from '@/store/useSimulatorStore';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { SimulatorMain } from './SimulatorMain';

const ConfigToggleButton = memo(function ConfigToggleButton() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      onClick={toggleSidebar}
    >
      <span>Configure your LBP</span>
      <ChevronDown
        className={cn(
          'h-4 w-4 transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </Button>
  );
});

const SimulatorContent = memo(function SimulatorContent() {
  const { open, openMobile, isMobile } = useSidebar();
  const isOpen = isMobile ? openMobile : open;

  return (
    <>
      {/* Accordion card: trigger + panel */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-2 border-b border-border/60">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="min-w-11 min-h-11 touch-manipulation shrink-0"
              aria-label="Back to landing page"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <ConfigToggleButton />
        </div>
        <div
          className={cn(
            'overflow-hidden transition-[max-height] duration-300 ease-out',
            isOpen ? 'max-h-[70vh]' : 'max-h-0',
          )}
        >
          <div className="overflow-auto max-h-[70vh]">
            <SimulatorConfig />
          </div>
        </div>
      </div>

      {/* Main simulator content card */}
      <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-card shadow-xl p-4 sm:p-6 md:p-8 overflow-hidden mt-4">
        <SimulatorHeader />
        <SimulatorStats />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SimulatorMain />
          </div>
          <div className="lg:col-span-1 flex">
            <SwapForm />
          </div>
        </div>
      </div>
    </>
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
    },
    [setIsConfigOpen],
  );

  return (
    <section
      id="lbp-settings"
      className="flex w-full flex-col container mx-auto px-4 md:px-6 pb-20 gap-0 min-h-0 mt-10"
    >
      <SidebarProvider
        open={isConfigOpen}
        onOpenChange={onOpenChange}
        className="w-full flex flex-col gap-0"
      >
        <SimulatorContent />
      </SidebarProvider>
    </section>
  );
}
