# run-progress

A run's progress and the console's words for it: the one owner of the status words of information architecture §4, for runs and for their steps, and of how a run started. Business logic without UI: callers put the words beside their own icons and tones.

Owner: web — runs. Decisions: information architecture §4 (status vocabulary: icon, word and tone, never colour alone), research D4 ("Failed", the person's word, while the api and the language keep `faulted`).

## API

- `PHASES`: the api's phases in their order. `phaseLabel(phase)`: Queued, Running, Waiting, Paused, Succeeded, Failed, Cancelled. `isUnended(phase)`: a queued, running, waiting or paused run.
- `StepStatus`: a phase, `retrying` or `skipped`; `StepState`: a status or `not-reached`. `stepStateLabel(state)`: the phase's word, Retrying, Skipped, or Not reached.
- `triggerLabel(trigger)`: "By hand", "Schedule", "Event", "Parent run", "Detached from a run", "Run again". `startedBy(trigger)`: "Started by hand", "Started by its schedule", and so on.
- `progressOf(records, steps)`: each step's latest status and how many times it ran, a block taking its latest child's status. `recordsOf(records, steps)`: the records of those steps.

run-periods names a status of one phase by the `phaseLabel` its caller passes, so the words stay here.

## Playground

`run-progress.stories.tsx`: every phase, step state and start in the console's words.
