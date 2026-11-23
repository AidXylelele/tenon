import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Bar, Figure } from "@/operations/run-periods";
import { PeriodFigures } from "./period-figures";
import { PeriodPicker } from "./period-picker";
import { RunsChart } from "./runs-chart";

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { readonly prefetch: boolean | null }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

const FIGURES: readonly Figure[] = [
  { kind: "started", count: 1234, previous: 1000 },
  { kind: "succeeded", count: 1200, previous: 1200 },
  { kind: "failed", count: 30, previous: 40 },
  { kind: "cancelled", count: 4, previous: null },
];

const BARS: readonly Bar[] = [
  {
    label: "Mon 16",
    from: "2026-11-16T00:00:00.000Z",
    to: "2026-11-17T00:00:00.000Z",
    succeeded: 5,
    failed: 1,
    cancelled: 0,
    inProgress: 2,
  },
];

function hrefOf(kind: string): string {
  return `/runs?status=${kind}`;
}

describe("the runs of a period", () => {
  it("each_period_is_a_link_and_the_chosen_one_is_marked", () => {
    render(
      <PeriodPicker period="7d" hrefOf={(period) => `/?period=${period}`} />,
    );
    const week = screen.getByRole("link", { name: "7 days" });
    const day = screen.getByRole("link", { name: "24 hours" });

    expect(week).toHaveAttribute("aria-current", "true");
    expect(day).toHaveAttribute("aria-current", "false");
    expect(day).toHaveAttribute("href", "/?period=24h");
  });

  it("each_figure_opens_its_runs_and_says_its_change_from_the_previous_period", () => {
    render(
      <PeriodFigures
        period="7d"
        figures={FIGURES}
        inProgress={9}
        hrefOf={hrefOf}
        inProgressHref="/runs?status=in-progress&started=all"
      />,
    );
    const started = screen.getByRole("link", { name: /^Started/ });
    const failed = screen.getByRole("link", { name: /^Failed/ });
    const live = screen.getByRole("link", { name: /^In progress now/ });

    expect(started).toHaveTextContent("1,234↑ from 1,000 the previous 7 days");
    expect(failed).toHaveAttribute("href", "/runs?status=failed");
    expect(failed).toHaveTextContent("↓ from 40");
    expect(live).toHaveTextContent("9live");
  });

  it("a_figure_without_a_previous_period_says_no_change", () => {
    render(
      <PeriodFigures
        period="30d"
        figures={FIGURES}
        inProgress={0}
        hrefOf={hrefOf}
        inProgressHref="/runs"
      />,
    );
    const cancelled = screen.getByRole("link", { name: /^Cancelled/ });

    expect(cancelled).toHaveTextContent(/^Cancelled4$/);
  });

  it("the_chart_says_its_zone_and_gives_the_same_numbers_as_a_table", () => {
    render(<RunsChart bars={BARS} unit="day" zone="Europe/Kyiv" />);
    const show = screen.getByRole("button", { name: "Show as table" });

    fireEvent.click(show);
    const table = screen.getByRole("region", {
      name: "Runs per day as a table",
    });
    const row = within(table).getByRole("row", { name: /Mon 16/ });

    expect(
      screen.getByText("Each bar is a day in your time zone, Europe/Kyiv."),
    ).toBeInTheDocument();
    expect(row).toHaveTextContent("Mon 1685102");
  });
});
