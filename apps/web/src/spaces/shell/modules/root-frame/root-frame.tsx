import { Toaster } from '@/libs/ui/components/sonner';
import { TooltipProvider } from '@/libs/ui/components/tooltip';

// What every page shares: tooltips and the toasts that report the outcome of actions.
export function RootFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster position="bottom-right" closeButton />
    </TooltipProvider>
  );
}
