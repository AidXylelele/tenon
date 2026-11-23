# run-table

Runs as a table, one row per run, and the numbered pages under it. Business UI with its logic: it gets a page of runs and the address of each page and order as props, and never reads the platform.

Owner: web — runs. Decisions: information architecture §4 (status words) and §5 "Runs" (columns, sortable Started and Duration, the pager "1–50 of 157", rows per page 25 / 50 / 100); research D5 of the console redesign (005); the approved mockup's `runTable` and `runsList` pager.

## API

- `<RunTable runs Status showWorkflow order empty />`
  - `runs`: the api's listed runs (`GET /instances`).
  - `Status`: the component that shows a phase (run-status's `PhaseStatus`), passed in so the table does not import another feature.
  - `showWorkflow`: `false` on a workflow's own page.
  - `order`: `{ sort, hrefOf(sort) }` makes Started and Duration links that order the list, newest or longest first, the chosen one marked `aria-sort="descending"`. Without it the headers are plain.
  - `empty`: shown instead of the table when there are no runs.
- `<RunPager page size total exact hrefOf />`: "51–100 of 157", or "1–50 of more than 10,000" when the platform stopped counting (`exact: false`); the first page, the last and two either side of this one, with gaps; Previous and Next; rows per page, which goes to the first page of the new size. `hrefOf(page, size)` gives each address, so the state stays in the address.

A row: the status in run-progress's words (a test run of a draft also says "Test"), when it started (a link to the run that covers the row), the workflow, the duration, who or what started it, and the version.

## Consumers

- `spaces/runs/modules/run-list`: Runs, ordered and paged.
- `spaces/workflows/modules/workflow-detail`: a workflow's runs.

## Playground

`run-table.stories.tsx`: a page of runs with a test run, ordered by duration, with its pager; a total past the counted runs. `e2e/run-table.spec.ts` is its smoke test.
