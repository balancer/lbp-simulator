"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Info } from "lucide-react";
import { memo, type ReactNode } from "react";

interface StatCardProps {
  label: string;
  description: string;
  children: ReactNode;
}

export const StatCard = memo(function StatCard({
  label,
  description,
  children,
}: StatCardProps) {
  return (
    <Card className="shadow-sm border-border/60 h-[90%]">
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label={`Learn more about ${label}`}
              >
                <Info className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{label}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <span className="text-lg md:text-xl font-semibold tracking-tight">
          {children}
        </span>
      </CardContent>
    </Card>
  );
});
