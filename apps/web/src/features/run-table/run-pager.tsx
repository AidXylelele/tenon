import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Link } from "@/libs/routing/link";
import { cn } from "@/libs/ui/tokens/cn";
import type { RunPagerProps } from "./interfaces";
import { PAGE_SIZES, pageCountOf, pageNumbersOf, rangeText } from "./pages";
import { RowsPerPage } from "./rows-per-page";

const PAGE_LINK =
  "inline-flex size-8 items-center justify-center rounded-md text-sm tabular-nums hover:bg-muted aria-[current=page]:border aria-[current=page]:font-semibold";

export function RunPager({ page, size, total, exact, hrefOf }: RunPagerProps) {
  const count = pageCountOf(total, size);
  const numbers = pageNumbersOf(page, count);
  const range = rangeText(page, size, total, exact);
  const previous = Math.max(1, page - 1);
  const next = Math.min(count, page + 1);
  const previousHref = hrefOf(previous, size);
  const nextHref = hrefOf(next, size);
  const sizes = PAGE_SIZES.map((each) => ({
    size: each,
    href: hrefOf(1, each),
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="tabular-nums">{range}</span>
      <nav aria-label="Pages" className="flex items-center gap-1">
        <PageStep
          href={previousHref}
          label="Previous page"
          disabled={page === 1}
          icon={<ChevronLeftIcon aria-hidden className="size-4" />}
        />
        {numbers.map((each) =>
          each.kind === "gap" ? (
            <span key={each.key} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <PageLink
              key={each.page}
              page={each.page}
              shown={page}
              size={size}
              hrefOf={hrefOf}
            />
          ),
        )}
        <PageStep
          href={nextHref}
          label="Next page"
          disabled={page === count}
          icon={<ChevronRightIcon aria-hidden className="size-4" />}
        />
      </nav>
      <RowsPerPage size={size} sizes={sizes} />
    </div>
  );
}

function PageLink({
  page,
  shown,
  size,
  hrefOf,
}: {
  readonly page: number;
  readonly shown: number;
  readonly size: number;
  readonly hrefOf: RunPagerProps["hrefOf"];
}) {
  const href = hrefOf(page, size);
  const label = `Page ${String(page)}`;
  const marked = page === shown ? "page" : undefined;

  return (
    <Link
      href={href}
      aria-current={marked}
      aria-label={label}
      className={PAGE_LINK}
    >
      {page}
    </Link>
  );
}

function PageStep({
  href,
  label,
  disabled,
  icon,
}: {
  readonly href: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly icon: React.ReactNode;
}) {
  if (disabled)
    return (
      <span
        aria-label={label}
        aria-disabled="true"
        role="link"
        className={cn(PAGE_LINK, "text-muted-foreground opacity-50")}
      >
        {icon}
      </span>
    );

  return (
    <Link href={href} aria-label={label} title={label} className={PAGE_LINK}>
      {icon}
    </Link>
  );
}
