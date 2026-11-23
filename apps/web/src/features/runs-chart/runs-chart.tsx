"use client";

import { Bar as RunBar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/libs/ui/components/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { type Bar, chartNoteOf } from "@/operations/run-periods";
import type { RunsChartProps } from "./interfaces";

const SERIES = ["succeeded", "failed", "cancelled", "inProgress"] as const;

const CONFIG = {
  succeeded: { label: "Succeeded", color: "var(--success-chart)" },
  failed: { label: "Failed", color: "var(--danger-chart)" },
  cancelled: { label: "Cancelled", color: "var(--neutral-chart)" },
  inProgress: { label: "In progress", color: "var(--info-chart)" },
} satisfies ChartConfig;

const FOCUS =
  "h-48 w-full aspect-auto [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-(--focus-ring)";

export function RunsChart({ bars, unit, zone }: RunsChartProps) {
  const note = chartNoteOf(unit, zone);
  const label = `Runs per ${unit}; arrow keys move between bars`;

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={CONFIG} className={FOCUS} aria-label={label}>
        <BarChart data={bars} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {SERIES.map((series) => (
            <RunBar
              key={series}
              dataKey={series}
              stackId="runs"
              fill={CONFIG[series].color}
              stroke="var(--surface)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <p className="text-caption text-muted-foreground">{note}</p>
      <Disclosure title="Show as table">
        <ChartTable bars={bars} unit={unit} />
      </Disclosure>
    </div>
  );
}

function ChartTable({
  bars,
  unit,
}: {
  readonly bars: readonly Bar[];
  readonly unit: RunsChartProps["unit"];
}) {
  const bucket = unit === "hour" ? "Hour" : "Day";
  const label = `Runs per ${unit} as a table`;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="overflow-x-auto"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{bucket}</TableHead>
            <TableHead className="text-right">Started</TableHead>
            <TableHead className="text-right">Succeeded</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Cancelled</TableHead>
            <TableHead className="text-right">In progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bars.map((bar) => (
            <ChartRow key={bar.from} bar={bar} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChartRow({ bar }: { readonly bar: Bar }) {
  const started = bar.succeeded + bar.failed + bar.cancelled + bar.inProgress;

  return (
    <TableRow>
      <TableCell>{bar.label}</TableCell>
      <TableCell className="text-right tabular-nums">{started}</TableCell>
      <TableCell className="text-right tabular-nums">{bar.succeeded}</TableCell>
      <TableCell className="text-right tabular-nums">{bar.failed}</TableCell>
      <TableCell className="text-right tabular-nums">{bar.cancelled}</TableCell>
      <TableCell className="text-right tabular-nums">
        {bar.inProgress}
      </TableCell>
    </TableRow>
  );
}
