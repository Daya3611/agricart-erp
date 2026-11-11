import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#228B4E] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-[#CDE7D4] bg-[#E8F5EC] text-[#176638] dark:border-[#1F3D2A] dark:bg-[#183323] dark:text-[#4ade80]',
        secondary: 'border-border bg-muted text-foreground',
        destructive: 'border-[#F8D2D2] bg-[#FDF1F1] text-[#DC5252] dark:border-[#7f1d1d]/40 dark:bg-[#450a0a]/30 dark:text-[#f87171]',
        warning: 'border-[#F6E6C4] bg-[#FEF7E8] text-[#D99A28] dark:border-[#78350f]/40 dark:bg-[#451a03]/30 dark:text-[#fbbf24]',
        info: 'border-[#D4E4FC] bg-[#EEF4FF] text-[#1D60C9] dark:border-[#1e3a8a]/40 dark:bg-[#172554]/30 dark:text-[#60a5fa]',
        purple: 'border-[#E9D8FD] bg-[#F5F0FF] text-[#6B21A8] dark:border-[#581c87]/40 dark:bg-[#3b0764]/30 dark:text-[#c084fc]',
        outline: 'border-border text-muted-foreground bg-card',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
