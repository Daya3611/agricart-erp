'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface RecordCardProps extends React.HTMLAttributes<HTMLDivElement> {
  statusBadge?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function RecordCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'p-3.5 sm:p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs space-y-3 transition-all hover:border-emerald-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function RecordCardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-2.5 pb-2 border-b border-slate-100', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function RecordCardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4
      className={cn('text-sm font-bold text-slate-900 leading-tight truncate', className)}
      {...props}
    >
      {children}
    </h4>
  );
}

export function RecordCardSubtitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-[11px] text-slate-500 font-medium leading-none mt-1', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function RecordCardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('space-y-1.5 text-xs text-slate-700', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function RecordCardRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-2 text-xs', className)}>
      <span className="text-slate-500 font-medium text-[11px] shrink-0">{label}:</span>
      <span className="text-slate-900 font-semibold text-right truncate">{value}</span>
    </div>
  );
}

export function RecordCardActions({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}
