"use client";

import { useState, useEffect, useRef } from "react";

const STEP_MS = 500; // same as store interval: 500 / speed gives ms per step

/**
 * Drives a smooth "display step" for chart reveal using requestAnimationFrame.
 * When playing, interpolates between store currentStep and currentStep+1 so the
 * chart re-renders every frame without updating the store. When not playing,
 * returns currentStep from store. Only consumers of this hook re-render every frame.
 */
export function useDisplayStep(
  isPlaying: boolean,
  simulationSpeed: number,
  totalSteps: number,
  currentStep: number,
  setCurrentStep: (step: number) => void
): number {
  const [, setTick] = useState(0);
  const displayStepRef = useRef(currentStep);
  const lastStoreStepRef = useRef(currentStep);
  const lastStoreStepTimeRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  // Sync refs when store currentStep changes (e.g. from tick() or pause)
  useEffect(() => {
    lastStoreStepRef.current = currentStep;
    lastStoreStepTimeRef.current = performance.now();
    if (!isPlaying) {
      displayStepRef.current = currentStep;
    }
  }, [currentStep, isPlaying]);

  // On pause: sync store to display step so next play starts from the right place
  const wasPlayingRef = useRef(isPlaying);
  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      setCurrentStep(Math.floor(displayStepRef.current));
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, setCurrentStep]);

  const stepDurationMs = STEP_MS / Math.max(0.1, simulationSpeed);

  useEffect(() => {
    if (!isPlaying) {
      displayStepRef.current = currentStep;
      return;
    }

    const onFrame = () => {
      const now = performance.now();
      const elapsed = now - lastStoreStepTimeRef.current;
      const stepsSinceLastStoreUpdate = elapsed / stepDurationMs;
      const raw =
        lastStoreStepRef.current + Math.min(stepsSinceLastStoreUpdate, 1);
      const displayStep = Math.min(
        Math.max(0, totalSteps - 1),
        Math.max(0, raw)
      );
      displayStepRef.current = displayStep;
      setTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(onFrame);
    };

    rafRef.current = requestAnimationFrame(onFrame);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, stepDurationMs, totalSteps]);

  if (!isPlaying) {
    return currentStep;
  }
  return displayStepRef.current;
}
