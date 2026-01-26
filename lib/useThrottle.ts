import { useEffect, useRef, useState } from "react";

/**
 * Custom hook to throttle a value
 * @param value - The value to throttle
 * @param delay - Delay in milliseconds (default: 100ms). If 0, returns value immediately.
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, delay: number = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If delay is 0, return value immediately without throttling
    if (delay === 0) {
      setThrottledValue(value);
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const timeSinceLastRun = Date.now() - lastRan.current;
    
    if (timeSinceLastRun >= delay) {
      // Enough time has passed, update immediately
      setThrottledValue(value);
      lastRan.current = Date.now();
    } else {
      // Schedule update for remaining time
      const remainingTime = delay - timeSinceLastRun;
      timeoutRef.current = setTimeout(() => {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }, remainingTime);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay]);

  return throttledValue;
}
