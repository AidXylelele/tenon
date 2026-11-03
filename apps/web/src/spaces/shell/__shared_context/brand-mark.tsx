import { cn } from 'cn';

// The console's mark: a run line with one task done and one in flight.
export function BrandMark({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('size-6 shrink-0', className)}
    >
      <rect width="24" height="24" rx="6" className="fill-foreground" />
      <path d="M12 5v14" className="stroke-background/40" strokeWidth="2" />
      <path d="M12 5v7" className="stroke-background" strokeWidth="2" />
      <circle cx="12" cy="7" r="2.25" className="fill-background" />
      <circle cx="12" cy="15.5" r="2.25" className="fill-sky-400" />
    </svg>
  );
}

export const PRODUCT_NAME = 'Workflow Platform';
