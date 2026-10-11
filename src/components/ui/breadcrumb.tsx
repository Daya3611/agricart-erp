import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" className={cn('flex items-center', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words text-xs font-medium text-slate-500 sm:gap-2',
        className
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />;
}

export function BreadcrumbLink({
  className,
  asChild,
  children,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  return (
    <a
      className={cn('transition-colors hover:text-slate-900', className)}
      {...props}
    >
      {children}
    </a>
  );
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-semibold text-slate-900', className)}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('text-slate-400 [&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight className="h-3.5 w-3.5" />}
    </li>
  );
}
