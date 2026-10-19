'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface DropdownMenuContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild,
  children,
  className,
}: {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  const { open, setOpen } = context;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler; 'aria-expanded'?: boolean }>, {
      onClick: handleClick,
      'aria-expanded': open,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={open}
      className={className}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = 'end',
  className,
  children,
}: {
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  if (!context.open) return null;

  const alignClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div
      role="menu"
      className={cn(
        'absolute z-50 mt-2 min-w-[220px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-popover text-popover-foreground p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150',
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  children,
  onClick,
  disabled,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const context = React.useContext(DropdownMenuContext);

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        if (disabled) return;
        onClick?.();
        context?.setOpen(false);
      }}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-popover-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:outline-none select-none',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1.5 my-1.5 h-[1px] bg-border', className)} />;
}

export function DropdownMenuLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('px-3 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider', className)}>
      {children}
    </div>
  );
}
