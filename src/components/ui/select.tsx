import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  pill?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, pill, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-10 w-full border border-slate-200/90 bg-white text-sm text-slate-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-2xs',
          pill ? 'rounded-full px-4' : 'rounded-xl px-3',
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export { Select };
