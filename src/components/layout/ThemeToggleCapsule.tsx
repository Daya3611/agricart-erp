'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export function useThemeTransition() {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchTheme = (targetMode: 'light' | 'dark') => {
    if (resolvedTheme === targetMode) return;
    setTheme(targetMode);
  };

  const toggleTheme = () => {
    const nextMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    switchTheme(nextMode);
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

/**
 * Theme toggle controls return null as visible theme-switching UI has been removed
 * while preserving the underlying theme infrastructure and hook.
 */
export function ThemeToggleCapsule() {
  return null;
}

export function ThemeToggleButton({ className }: { className?: string }) {
  return null;
}

export function ThemeToggleSegmented({
  className,
  fullWidth = false,
}: {
  className?: string;
  fullWidth?: boolean;
}) {
  return null;
}
