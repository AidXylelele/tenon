import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DisclosureProps {
  readonly title: string;
  readonly summary: string;
  readonly initiallyOpen?: boolean;
  readonly children: ReactNode;
}

export function Disclosure({
  title,
  summary,
  initiallyOpen = false,
  children,
}: DisclosureProps) {
  return (
    <details className="group rounded-lg border" open={initiallyOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 font-semibold hover:bg-hover [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-normal text-muted-foreground">
          <span className="truncate">{summary}</span>
          <ChevronDownIcon
            className="size-4 shrink-0 transition-transform duration-(--duration-fast) ease-standard group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t px-3 pt-3 pb-4">
        {children}
      </div>
    </details>
  );
}
