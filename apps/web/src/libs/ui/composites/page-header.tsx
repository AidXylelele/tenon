import { cn } from 'cn';
import { type Crumb, Crumbs } from './crumbs';

interface PageHeaderProps {
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  // Where the page sits, ending with the page itself (FR-034).
  readonly crumbs?: readonly Crumb[];
  // 2 for a tab of a page made of several (Connections, Settings): the tab names it, so the
  // title is for assistive technologies only.
  readonly level?: 1 | 2;
  readonly className?: string;
}

// The heading of a page: where it sits, the title, a short description, and the page's main
// actions, which wrap under the title on narrow screens.
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  level = 1,
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
        {crumbs !== undefined && <Crumbs trail={crumbs} />}
        {level === 1 ? (
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
        ) : (
          <h2 className="sr-only">{title}</h2>
        )}
        {description !== undefined && (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
