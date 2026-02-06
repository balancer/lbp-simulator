"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useMemo } from "react";

type UseCaseStudyDialogProps = {
  caseStudy: {
    title: string;
    summary: string;
    takeaways?: string[];
    whatHappened?: string;
    keyResults?: string[];
    rightChoice?: string[];
    showCurve?: boolean;
    chart?: {
      type: "mpl-price" | "akita-weights";
      title: string;
      caption?: string;
      data?: number[];
    };
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const buildLinePath = (values: number[], width: number, height: number) => {
  if (values.length === 0) return "";
  const padding = 12;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);
  return values
    .map((value, i) => {
      const x = padding + i * step;
      const y = padding + ((max - value) / range) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const buildSegmentedPath = (
  values: number[],
  width: number,
  height: number,
  startIndex: number,
  endIndex: number,
) => {
  if (values.length === 0) return "";
  const clampedStart = Math.max(0, Math.min(values.length - 1, startIndex));
  const clampedEnd = Math.max(clampedStart, Math.min(values.length - 1, endIndex));
  const padding = 12;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);
  const points = [];
  for (let i = clampedStart; i <= clampedEnd; i += 1) {
    const value = values[i];
    const x = padding + i * step;
    const y = padding + ((max - value) / range) * (height - padding * 2);
    points.push(`${i === clampedStart ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
};

export function UseCaseStudyDialog({
  caseStudy,
  open,
  onOpenChange,
}: UseCaseStudyDialogProps) {
  const {
    title,
    summary,
    takeaways,
    whatHappened,
    keyResults,
    rightChoice,
    showCurve,
    chart,
  } = caseStudy;

  const mplPath = useMemo(() => {
    const series = chart?.type === "mpl-price" ? chart.data ?? [] : [];
    if (series.length === 0) return "";
    return buildLinePath(series, 300, 120);
  }, [chart]);

  const akitaPaths = useMemo(() => {
    if (chart?.type !== "akita-weights") return null;
    const akita = buildLinePath([99, 1], 300, 120);
    const weth = buildLinePath([1, 99], 300, 120);
    return { akita, weth };
  }, [chart?.type]);

  const rlbpChart = useMemo(() => {
    if (!showCurve) return null;
    const series = [
      0.92, 0.94, 0.955, 0.95, 0.958, 0.945, 0.97, 0.96, 0.965, 0.955, 0.948,
      0.96, 0.965, 0.955, 0.95, 0.955, 0.96, 0.958, 0.962, 0.955, 0.948, 0.955,
      0.95, 0.97, 1.02, 1.12,
    ];
    const solidPath = buildSegmentedPath(series, 300, 140, 0, 22);
    const dashedPath = buildSegmentedPath(series, 300, 140, 22, 25);
    return { solidPath, dashedPath };
  }, [showCurve]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="w-[50%] rounded-full bg-[#E6C8A3] text-[#171717] hover:bg-[#E6C8A3]/85"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          See a study case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-10">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        {whatHappened && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-semibold text-foreground">
              What happened
            </div>
            <p className="text-sm text-muted-foreground">{whatHappened}</p>
          </div>
        )}
        {keyResults && keyResults.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Key results
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {keyResults.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#E6C8A3]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {rightChoice && rightChoice.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Why rLBP was the right choice
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {rightChoice.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#E6C8A3]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {chart && (
          <div className="mt-6 space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {chart.title}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {chart.caption}
            </div>
            <div className="mt-2">
              <svg viewBox="0 0 300 120" className="h-28 w-full">
                <path
                  d="M10 100 L 290 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-foreground/20"
                />
                {chart.type === "mpl-price" && (
                  <>
                    {mplPath && (
                      <path
                        d={mplPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-foreground/80"
                      />
                    )}
                  </>
                )}
                {chart.type === "akita-weights" && akitaPaths && (
                  <>
                    <path
                      d={akitaPaths.akita}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-foreground/80"
                    />
                    <path
                      d={akitaPaths.weth}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-foreground/40"
                    />
                  </>
                )}
              </svg>
            </div>
            {chart.type === "akita-weights" && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground/80" />
                  AKITA weight
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-foreground/40" />
                  WETH weight
                </div>
              </div>
            )}
          </div>
        )}
        {takeaways && takeaways.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Takeaways
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {takeaways.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#E6C8A3]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {showCurve && (
          <div className="mt-6 rounded-xl border border-border/60 bg-background/80 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              rLBP Price Tracking
            </div>
            <svg viewBox="0 0 320 170" className="mt-3 h-28 w-full">
              <defs>
                <linearGradient id="rlbpLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#E6C8A3" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#E6C8A3" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              <rect x="12" y="16" width="296" height="130" fill="transparent" />
              {[0, 1, 2, 3, 4].map((row) => (
                <line
                  key={`h-${row}`}
                  x1="12"
                  y1={20 + row * 26}
                  x2="308"
                  y2={20 + row * 26}
                  stroke="currentColor"
                  strokeOpacity="0.18"
                  strokeWidth="1"
                />
              ))}
              {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                <line
                  key={`v-${col}`}
                  x1={12 + col * 49}
                  y1="20"
                  x2={12 + col * 49}
                  y2="150"
                  stroke="currentColor"
                  strokeOpacity="0.14"
                  strokeWidth="1"
                />
              ))}
              {rlbpChart && (
                <>
                  <path
                    d={rlbpChart.solidPath}
                    fill="none"
                    stroke="url(#rlbpLine)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={rlbpChart.dashedPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeOpacity="0.7"
                  />
                </>
              )}
              <text x="12" y="166" className="fill-foreground/40 text-[9px]">
                09 AM
              </text>
              <text x="90" y="166" className="fill-foreground/40 text-[9px]">
                12 PM
              </text>
              <text x="168" y="166" className="fill-foreground/40 text-[9px]">
                03 PM
              </text>
              <text x="246" y="166" className="fill-foreground/40 text-[9px]">
                06 PM
              </text>
            </svg>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
