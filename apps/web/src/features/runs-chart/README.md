# runs-chart

The runs of a period: the period control, the figures with their change from the previous period, the live count of runs in progress, and the runs chart with its table. Business UI with its logic: it gets the figures and the bars run-periods made as props and the address each figure opens, and never reads the platform.

Owner: web — runs. Decisions: information architecture §5 "Home" (figures, "In progress now", the chart, "Show as table") and §4 (status words); research D4 (a run belongs to a period by its start; in progress is live, apart from the period) and D12 (test runs are not counted); design system: Chart is shadcn Chart (Recharts), stacked bars, tooltip on hover and focus, segments separated by 1 px of `--surface`, the chart colour tokens; the approved mockup's `figures`, `chart`, `legend` and `chartTable`.

## API

- `<PeriodPicker period hrefOf />`: 24 hours · 7 days · 30 days as links, the chosen one `aria-current`; `hrefOf(period)` keeps the period in the address.
- `<PeriodFigures period figures inProgress hrefOf inProgressHref />`: Started, Succeeded, Failed and Cancelled (run-periods' `figuresOf`), each a link to its runs (`hrefOf(kind)`) with "↑ from 8 the previous 7 days" when a previous period was counted; then, apart, "In progress now" with its live count and its link.
- `<RunsChart bars hrefs unit zone />`: run-periods' `seriesOf` bars stacked Succeeded, Failed, Cancelled, In progress; Recharts' accessibility layer makes the chart one Tab stop whose arrow keys move the tooltip between bars; a click on a bar, or Enter on the bar the keys reached, opens `hrefs[i]`, that bar's runs; the note under it says the zone of the buckets ("Each bar is a day in your time zone, Europe/Kyiv.", or UTC when the viewer's zone is not known yet); "Show as table" gives the same numbers.

## Consumers

- `spaces/home/modules/overview`: Home.
- A workflow's Overview (planned, `spaces/workflows`).

## Playground

`runs-chart.stories.tsx`: seven days in Kyiv and 24 hours in UTC. `e2e/runs-chart.spec.ts` is its smoke test.
