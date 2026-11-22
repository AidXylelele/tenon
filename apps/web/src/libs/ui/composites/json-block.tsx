import { CopyButton } from "./copy-button";

interface JsonBlockProps {
  readonly value: unknown;
  readonly empty?: string;
}

export function JsonBlock({ value, empty = "Nothing" }: JsonBlockProps) {
  if (value === undefined || value === null)
    return <p className="text-sm text-muted-foreground">{empty}</p>;

  const text = JSON.stringify(value, null, 2);

  return (
    <div className="relative min-w-0">
      <pre className="max-h-96 overflow-auto rounded-lg border bg-muted p-3 pr-10 font-mono text-xs leading-relaxed">
        {text}
      </pre>
      <div className="absolute top-1.5 right-1.5">
        <CopyButton value={text} size="icon-xs" />
      </div>
    </div>
  );
}
