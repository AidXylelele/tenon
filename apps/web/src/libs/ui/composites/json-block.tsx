import { cn } from 'cn';
import { CopyButton } from './copy-button';

interface JsonBlockProps {
  readonly value: unknown;
  readonly className?: string;
  readonly empty?: string;
}

// A JSON value, pretty-printed, scrollable and copyable. React escapes the text.
export function JsonBlock({
  value,
  className,
  empty = 'Nothing',
}: JsonBlockProps) {
  if (value === undefined || value === null)
    return <p className="text-sm text-muted-foreground">{empty}</p>;

  const text = JSON.stringify(value, null, 2);

  return (
    <div className={cn('group relative min-w-0', className)}>
      <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
      <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton value={text} size="icon-xs" />
      </div>
    </div>
  );
}
