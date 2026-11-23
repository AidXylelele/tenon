import { Link } from "@/libs/routing/link";
import { periodLabel, PERIODS } from "@/operations/run-periods";
import type { PeriodPickerProps } from "./interfaces";

const OPTION =
  "inline-flex h-8 items-center rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground aria-[current=true]:bg-background aria-[current=true]:font-medium aria-[current=true]:text-foreground aria-[current=true]:shadow-xs";

export function PeriodPicker({ period, hrefOf }: PeriodPickerProps) {
  return (
    <nav
      aria-label="Period"
      className="inline-flex w-fit items-center gap-0.5 rounded-md border bg-track p-0.5"
    >
      {PERIODS.map((each) => (
        <PeriodLink key={each} period={each} chosen={period} hrefOf={hrefOf} />
      ))}
    </nav>
  );
}

function PeriodLink({
  period,
  chosen,
  hrefOf,
}: {
  readonly period: PeriodPickerProps["period"];
  readonly chosen: PeriodPickerProps["period"];
  readonly hrefOf: PeriodPickerProps["hrefOf"];
}) {
  const href = hrefOf(period);
  const label = periodLabel(period);
  const current = period === chosen;

  return (
    <Link href={href} aria-current={current} className={OPTION}>
      {label}
    </Link>
  );
}
