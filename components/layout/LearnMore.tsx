"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";
import { Button } from "../ui/button";
import Link from "next/link";
import { animate } from "animejs";
import { BookOpen } from "lucide-react";

const LearnMore = () => {
  const buttonRef = useRef<HTMLAnchorElement | null>(null);
  const iconWrapRef = useRef<HTMLSpanElement | null>(null);
  const collapsedWidthRef = useRef<number | null>(null);
  const expandedWidthRef = useRef<number | null>(null);
  const isExpandedRef = useRef(false);
  const runningAnimationsRef = useRef<Array<{ cancel?: () => void }>>([]);

  const cancelRunningAnimations = useCallback(() => {
    runningAnimationsRef.current.forEach((animation) => animation?.cancel?.());
    runningAnimationsRef.current = [];
  }, []);

  const computeWidths = useCallback(() => {
    const buttonEl = buttonRef.current;
    const iconWrapEl = iconWrapRef.current;
    if (!buttonEl) return;

    const wasExpanded = isExpandedRef.current;

    buttonEl.style.width = "auto";
    if (iconWrapEl) {
      iconWrapEl.style.width = "0px";
      iconWrapEl.style.marginLeft = "0px";
      iconWrapEl.style.opacity = "0";
      iconWrapEl.style.transform = "translateX(-6px)";
    }
    const collapsedWidth = buttonEl.getBoundingClientRect().width;
    collapsedWidthRef.current = collapsedWidth;

    const iconWidth = 16;
    const iconGap = 8;
    expandedWidthRef.current = collapsedWidth + iconWidth + iconGap;

    if (iconWrapEl && wasExpanded) {
      iconWrapEl.style.width = `${iconWidth}px`;
      iconWrapEl.style.marginLeft = `${iconGap}px`;
      iconWrapEl.style.opacity = "1";
      iconWrapEl.style.transform = "translateX(0px)";
    }

    buttonEl.style.width = wasExpanded
      ? `${expandedWidthRef.current}px`
      : `${collapsedWidth}px`;
    buttonEl.style.willChange = "width";
    buttonEl.style.overflow = "hidden";
  }, []);

  useLayoutEffect(() => {
    const iconWrapEl = iconWrapRef.current;
    if (iconWrapEl) {
      iconWrapEl.style.width = "0px";
      iconWrapEl.style.marginLeft = "0px";
      iconWrapEl.style.opacity = "0";
      iconWrapEl.style.transform = "translateX(-6px)";
      iconWrapEl.style.willChange = "width, margin-left, opacity, transform";
      iconWrapEl.style.overflow = "hidden";
      iconWrapEl.style.display = "inline-flex";
      iconWrapEl.style.alignItems = "center";
    }

    computeWidths();

    const handleResize = () => computeWidths();
    window.addEventListener("resize", handleResize);

    const fonts = (document as unknown as { fonts?: { ready?: Promise<void> } })
      .fonts;
    fonts?.ready?.then(() => computeWidths());

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelRunningAnimations();
    };
  }, [cancelRunningAnimations, computeWidths]);

  const expand = useCallback(() => {
    const buttonEl = buttonRef.current;
    const iconWrapEl = iconWrapRef.current;
    const expandedWidth = expandedWidthRef.current;
    if (!buttonEl || !iconWrapEl || !expandedWidth) return;

    isExpandedRef.current = true;
    cancelRunningAnimations();

    runningAnimationsRef.current = [
      animate(buttonEl, {
        width: expandedWidth,
        duration: 320,
        easing: "easeOutQuad",
      }),
      animate(iconWrapEl, {
        width: 16,
        marginLeft: 8,
        opacity: 1,
        translateX: [-6, 0],
        duration: 320,
        easing: "easeOutQuad",
      }),
    ];
  }, [cancelRunningAnimations]);

  const collapse = useCallback(() => {
    const buttonEl = buttonRef.current;
    const iconWrapEl = iconWrapRef.current;
    const collapsedWidth = collapsedWidthRef.current;
    if (!buttonEl || !iconWrapEl || !collapsedWidth) return;

    isExpandedRef.current = false;
    cancelRunningAnimations();

    runningAnimationsRef.current = [
      animate(buttonEl, {
        width: collapsedWidth,
        duration: 240,
        easing: "easeOutQuad",
      }),
      animate(iconWrapEl, {
        width: 0,
        marginLeft: 0,
        opacity: 0,
        translateX: [0, -6],
        duration: 240,
        easing: "easeOutQuad",
      }),
    ];
  }, [cancelRunningAnimations]);

  return (
    <div className="flex items-center justify-center mt-15">
      <Button
        asChild
        size="lg"
        className="bg-[#E6C8A3] hover:bg-[#E6C8A3]/80 text-[#171717] rounded-full px-8 text-base cursor-pointer gap-0 transition-colors"
      >
        <Link
          ref={buttonRef}
          href="https://docs.balancer.fi/concepts/explore-available-balancer-pools/liquidity-bootstrapping-pool/liquidity-bootstrapping-pool.html"
          onMouseEnter={expand}
          onMouseLeave={collapse}
          onFocus={expand}
          onBlur={collapse}
        >
          <span className="whitespace-nowrap">Learn more about LBPs</span>
          <span ref={iconWrapRef} aria-hidden="true">
            <BookOpen />
          </span>
        </Link>
      </Button>
    </div>
  );
};

export default LearnMore;
