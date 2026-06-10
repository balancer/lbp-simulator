'use client';

import { useEffect, useState, useRef, memo } from 'react';
import { cn } from '@/lib/utils';

const SCROLL_THRESHOLD = 60;

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay'
    )
      return parent;
    parent = parent.parentElement;
  }
  return null;
}

function HeaderComponent() {
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    const scrollParent = getScrollParent(el);
    if (!scrollParent) return;

    const handleScroll = () => {
      setHidden(scrollParent.scrollTop > SCROLL_THRESHOLD);
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        'fixed top-0 z-50 w-full transition-transform duration-300 ease-out',
        hidden && '-translate-y-full',
      )}
    />
  );
}

export const Header = memo(HeaderComponent);
