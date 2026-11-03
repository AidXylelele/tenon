import { cn } from 'cn';

interface PageHeaderProps {
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly eyebrow?: React.ReactNode;
  readonly className?: string;
}

// The heading of a page: an optional eyebrow (breadcrumb or kind), the title, a short
// description, and the page's main actions, which wrap under the title on narrow screens.
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow !== undefined && (
          <div className="text-xs font-medium text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
