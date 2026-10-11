import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs shadow-emerald-700/20',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-600/20',
        outline: 'border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs',
        secondary: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-100/80',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        link: 'text-emerald-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 rounded-full',
        sm: 'h-8 px-4 text-xs rounded-full',
        lg: 'h-12 px-7 text-base rounded-full',
        icon: 'h-9 w-9 p-0 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
