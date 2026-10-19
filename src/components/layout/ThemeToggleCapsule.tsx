'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function useThemeTransition() {
  const { setTheme, resolvedTheme, theme } = useTheme();
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

  const toggleTheme = (event?: React.MouseEvent) => {
    const nextMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    switchTheme(nextMode, event);
  };

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    mounted,
    switchTheme,
    toggleTheme,
    setTheme,
  };
}

export function ThemeToggleCapsule() {
  const { isDark, mounted, switchTheme } = useThemeTransition();

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

/**
 * Compact circular theme toggle button (ideal for mobile headers & icon toolbars)
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { isDark, mounted, toggleTheme } = useThemeTransition();

  if (!mounted) {
    return (
      <div
        className={cn(
          'h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground shadow-2xs',
          className
        )}
        aria-hidden="true"
      >
        <Sun className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'h-9 w-9 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted transition-all flex items-center justify-center shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-500 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}

/**
 * Horizontal segmented theme switch (ideal for dropdowns, drawers, and bottom sheets)
 */
export function ThemeToggleSegmented({
  className,
  fullWidth = false,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  const { isDark, mounted, switchTheme } = useThemeTransition();

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl',
          fullWidth && 'w-full',
          className
        )}
      >
        <div
          className={cn(
            'h-7 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs text-muted-foreground',
            fullWidth && 'flex-1'
          )}
        >
          <Sun className="h-3.5 w-3.5" />
          <span>Light</span>
        </div>
        <div
          className={cn(
            'h-7 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs text-muted-foreground',
            fullWidth && 'flex-1'
          )}
        >
          <Moon className="h-3.5 w-3.5" />
          <span>Dark</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode toggle"
      className={cn(
        'flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl',
        fullWidth && 'w-full',
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        onClick={(e) => switchTheme('light', e)}
        className={cn(
          'h-7 px-2.5 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          fullWidth && 'flex-1',
          !isDark
            ? 'bg-card text-foreground shadow-2xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sun className={cn('h-3.5 w-3.5', !isDark ? 'text-amber-500' : '')} />
        <span>Light</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        onClick={(e) => switchTheme('dark', e)}
        className={cn(
          'h-7 px-2.5 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          fullWidth && 'flex-1',
          isDark
            ? 'bg-card text-foreground shadow-2xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Moon className={cn('h-3.5 w-3.5', isDark ? 'text-primary' : '')} />
        <span>Dark</span>
      </button>
    </div>
  );
}
