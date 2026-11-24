interface PageHeaderProps {
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly level?: 1 | 2;
}

export function PageHeader({
  title,
  description,
  actions,
  level = 1,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {level === 1 ? (
          <h1 className="heading-1 break-words">{title}</h1>
        ) : (
          <h2 className="sr-only">{title}</h2>
        )}
        {description !== undefined && (
          <p className="max-w-prose text-caption text-muted-foreground">
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
