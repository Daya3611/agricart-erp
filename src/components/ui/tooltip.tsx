'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'right',
  disabled = false,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  if (disabled || !content) {
    return children;
  }

  const sidePositions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2.5',
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-50 shadow-md animate-in fade-in-0 zoom-in-95 duration-150',
            sidePositions[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
