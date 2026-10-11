import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ className, size = 'md', ...props }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200/80 select-none items-center justify-center font-bold bg-emerald-700 text-white shadow-2xs',
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}

export function AvatarFallback({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('flex h-full w-full items-center justify-center uppercase font-bold', className)}>
      {children}
    </span>
  );
}
