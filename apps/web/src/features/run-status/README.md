# run-status

A run's status and a step's status as an icon and a word in run-progress's vocabulary, never colour alone. Business UI: it gets a phase or a step's status as a prop.

Owner: web — runs. Decisions: information architecture §4 (status vocabulary: Queued, Running, Waiting, Paused, Succeeded, Failed, Cancelled, Skipped; a running status pulses five times, then stays still, and not at all under reduced motion — WCAG 2.2 SC 1.4.1 and 2.2.2).

## API

- `<PhaseStatus phase className />`: a run's phase.
- `<TaskStatusOf status />`: a step's status.

## Consumers

Runs, a run, Home, the workflows list and a workflow's page; run-table takes `PhaseStatus` as its `Status` slot.

## Playground

`run-status.stories.tsx`: every run status and every step status. `e2e/run-status.spec.ts` is its smoke test.
