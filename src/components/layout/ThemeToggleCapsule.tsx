'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ThemeToggleCapsule() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchTheme = (targetMode: 'light' | 'dark', event?: React.MouseEvent) => {
    if (resolvedTheme === targetMode) return;

    // Check for startViewTransition support and reduced motion preference
    if (
      typeof document === 'undefined' ||
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setTheme(targetMode);
      return;
    }

    // Coordinates for the circular reveal origin
    const target = event?.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : event?.clientX ?? window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : event?.clientY ?? window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      setTheme(targetMode);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: targetMode === 'dark' ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 280,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement:
            targetMode === 'dark'
              ? '::view-transition-new(root)'
              : '::view-transition-old(root)',
        }
      );
    });
  };

  if (!mounted) {
    return (
      <div
        role="radiogroup"
        aria-label="Theme mode toggle"
        className="w-9 h-16 rounded-full bg-card border border-border p-1 flex flex-col items-center justify-between shadow-2xs"
      >
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
          <Sun className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="h-6 w-6 rounded-full flex items-center justify-center">
          <Moon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode toggle"
      className="w-9 h-16 rounded-full bg-card border border-border p-1 flex flex-col items-center justify-between shadow-2xs transition-colors"
    >
      {/* Sun / Light button */}
      <button
        type="button"
        onClick={(e) => switchTheme('light', e)}
        aria-label="Switch to light mode"
        aria-checked={!isDark}
        title="Switch to light mode"
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          !isDark
            ? 'bg-muted text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>

      {/* Moon / Dark button */}
      <button
        type="button"
        onClick={(e) => switchTheme('dark', e)}
        aria-label="Switch to dark mode"
        aria-checked={isDark}
        title="Switch to dark mode"
        className={cn(
          'h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isDark
            ? 'bg-foreground text-background shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
