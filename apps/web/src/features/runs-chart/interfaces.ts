import type { Bar, Figure, FigureKind, Period } from "@/operations/run-periods";

export interface PeriodPickerProps {
  readonly period: Period;
  readonly hrefOf: (period: Period) => string;
}

export interface PeriodFiguresProps {
  readonly period: Period;
  readonly figures: readonly Figure[];
  readonly inProgress: number;
  readonly hrefOf: (kind: FigureKind) => string;
  readonly inProgressHref: string;
}

export interface RunsChartProps {
  readonly bars: readonly Bar[];
  readonly hrefs: readonly string[];
  readonly unit: "hour" | "day";
  readonly zone: string;
}
