import {
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  HourglassIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/libs/routing/link";
import { cn } from "@/libs/ui/tokens/cn";
import {
  changeText,
  type Figure,
  type FigureKind,
  periodPhrase,
} from "@/operations/run-periods";
import type { PeriodFiguresProps } from "./interfaces";

interface FigureLook {
  readonly label: string;
  readonly icon: LucideIcon | null;
  readonly tone: string;
}

const LOOK: Readonly<Record<FigureKind, FigureLook>> = {
  started: { label: "Started", icon: null, tone: "" },
  succeeded: {
    label: "Succeeded",
    icon: CircleCheckIcon,
    tone: "text-success",
  },
  failed: { label: "Failed", icon: CircleXIcon, tone: "text-destructive" },
  cancelled: {
    label: "Cancelled",
    icon: CircleSlashIcon,
    tone: "text-muted-foreground",
  },
};

const numbers = new Intl.NumberFormat("en-US");

const FIGURE =
  "flex min-w-32 flex-col gap-0.5 rounded-md p-2 hover:bg-muted focus-visible:bg-muted";

export function PeriodFigures({
  period,
  figures,
  inProgress,
  hrefOf,
  inProgressHref,
}: PeriodFiguresProps) {
  const phrase = periodPhrase(period);
  const label = `Runs ${phrase}; test runs are not counted`;
  const live = numbers.format(inProgress);

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-stretch gap-x-4 gap-y-2"
    >
      {figures.map((figure) => (
        <PeriodFigure
          key={figure.kind}
          figure={figure}
          period={period}
          hrefOf={hrefOf}
        />
      ))}
      <span
        aria-hidden
        className="hidden w-px self-stretch bg-border sm:block"
      />
      <Link href={inProgressHref} className={FIGURE}>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <HourglassIcon aria-hidden className="size-4 text-info" />
          In progress now
        </span>
        <span className="text-2xl font-semibold tabular-nums">{live}</span>
        <span className="text-caption text-muted-foreground">live</span>
      </Link>
    </div>
  );
}

function PeriodFigure({
  figure,
  period,
  hrefOf,
}: {
  readonly figure: Figure;
  readonly period: PeriodFiguresProps["period"];
  readonly hrefOf: PeriodFiguresProps["hrefOf"];
}) {
  const look = LOOK[figure.kind];
  const Icon = look.icon;
  const href = hrefOf(figure.kind);
  const count = numbers.format(figure.count);
  const iconClasses = cn("size-4", look.tone);

  return (
    <Link href={href} className={FIGURE}>
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon !== null && <Icon aria-hidden className={iconClasses} />}
        {look.label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{count}</span>
      {figure.previous !== null && (
        <Change
          count={figure.count}
          previous={figure.previous}
          period={period}
        />
      )}
    </Link>
  );
}

function Change({
  count,
  previous,
  period,
}: {
  readonly count: number;
  readonly previous: number;
  readonly period: PeriodFiguresProps["period"];
}) {
  const text = changeText(count, previous, period);

  return <span className="text-caption text-muted-foreground">{text}</span>;
}
