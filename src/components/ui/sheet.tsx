'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextType | null>(null);

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  asChild,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('SheetTrigger must be used within Sheet');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    context.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: handleClick,
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export function SheetClose({
  asChild,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('SheetClose must be used within Sheet');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    context.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: handleClick,
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'bottom' | 'left' | 'right';
  showGrabHandle?: boolean;
}

export function SheetContent({
  side = 'bottom',
  showGrabHandle = side === 'bottom',
  className,
  children,
  ...props
}: SheetContentProps) {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('SheetContent must be used within Sheet');
  const { open, setOpen } = context;

  // Handle Escape key
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  if (!open) return null;

  // Alignment and container padding for each side variant
  const containerAlignment = {
    top: 'items-start justify-center p-3 sm:p-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]',
    bottom:
      'items-end justify-center p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-6',
    left: 'items-center justify-start p-3 sm:p-4',
    right: 'items-center justify-end p-3 sm:p-4',
  };

  const sideClasses = {
    top: 'w-full max-w-lg rounded-2xl sm:rounded-3xl animate-in slide-in-from-top duration-200 border border-slate-200/90 shadow-2xl',
    bottom:
      'w-full max-w-lg max-h-[85vh] rounded-2xl sm:rounded-3xl animate-in slide-in-from-bottom duration-200 border border-slate-200/90 shadow-2xl',
    left: 'h-full max-h-[92vh] w-80 max-w-[85vw] rounded-2xl sm:rounded-3xl animate-in slide-in-from-left duration-200 border border-slate-200/90 shadow-2xl',
    right:
      'h-full max-h-[92vh] w-80 max-w-[85vw] rounded-2xl sm:rounded-3xl animate-in slide-in-from-right duration-200 border border-slate-200/90 shadow-2xl',
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex pointer-events-none',
        containerAlignment[side]
      )}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 pointer-events-auto cursor-pointer"
        onClick={() => setOpen(false)}
        onTouchEnd={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        aria-hidden="true"
      />

      {/* Floating Sheet Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-50 pointer-events-auto bg-card border-border flex flex-col overflow-hidden text-foreground',
          sideClasses[side],
          className
        )}
        {...props}
      >
        {/* Top-right accessible close button */}
        {/* <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3.5 top-3.5 z-20 h-8 w-8 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button> */}

        {showGrabHandle && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full flex justify-center pt-3 pb-1 shrink-0 cursor-pointer group focus-visible:outline-none"
            aria-label="Close drawer"
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors" />
          </button>
        )}
        <div className="relative flex-1 overflow-y-auto px-4 sm:px-6 py-2 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between pb-3 mb-2 border-b border-slate-100', className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-base font-bold text-slate-900 leading-tight', className)}
      {...props}
    />
  );
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs text-slate-500 mt-0.5', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-3', className)}
      {...props}
    />
  );
}
