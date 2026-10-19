import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#228B4E] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[#176638] shadow-xs shadow-primary/20',
        dark: 'bg-[#252923] text-white hover:bg-[#176638] dark:bg-card dark:text-card-foreground dark:border dark:border-border shadow-xs',
        destructive: 'bg-[#DC5252] text-white hover:bg-[#b93838] shadow-xs shadow-[#DC5252]/20',
        outline: 'border border-border bg-card text-foreground hover:bg-muted hover:border-primary/40 shadow-2xs',
        secondary: 'bg-[#E8F5EC] text-[#176638] hover:bg-[#d5edd9] border border-[#CDE7D4] dark:bg-[#183323] dark:text-[#4ade80] dark:border-[#1F3D2A]',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 rounded-full',
        sm: 'h-8 px-3.5 text-xs rounded-full',
        lg: 'h-11 px-6 text-sm rounded-full',
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
