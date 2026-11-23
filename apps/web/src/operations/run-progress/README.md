# run-progress

A run's progress and the console's words for it: the one owner of the status words of information architecture §4, for runs and for their steps, and of how a run started. Business logic without UI: callers put the words beside their own icons and tones.

Owner: web — runs. Decisions: information architecture §4 (status vocabulary: icon, word and tone, never colour alone), research D4 ("Failed", the person's word, while the api and the language keep `faulted`).

## API

- `PHASES`: the api's phases in their order. `phaseLabel(phase)`: Queued, Running, Waiting, Paused, Succeeded, Failed, Cancelled. `statusLabel(status)`: In progress, Succeeded, Failed, Cancelled — the one owner of the status words.
- `RunStatus`, `STATUSES` and `phasesOf(status)`: In progress counts the api's `LIVE_PHASES` (queued, running, waiting, paused); Succeeded `completed`; Failed `faulted`; Cancelled `cancelled`. `statusOf(phase)`: the status that counts a phase. `isUnended(phase)`: a run whose status is In progress.
- `statusParamOf(statuses)`: the `status` parameter, such as `in-progress,failed`, in the order of `STATUSES` and each once; `statusesOf(text)` reads it back and drops unknown words. `runsPhraseOf(statuses)`: "All runs", "Failed", "In progress or failed"; the module adds the period and the total.
- `StepStatus`: a phase, `retrying` or `skipped`; `StepState`: a status or `not-reached`. `stepStateLabel(state)`: the phase's word, Retrying, Skipped, or Not reached.
- `triggerLabel(trigger)`: "By hand", "Schedule", "Event", "Parent run", "Detached from a run", "Run again". `startedBy(trigger)`: "Started by hand", "Started by its schedule", and so on.
- `progressOf(records, steps)`: each step's latest status and how many times it ran, a block taking its latest child's status. `recordsOf(records, steps)`: the records of those steps.

run-periods names a status of one phase by the `phaseLabel` its caller passes, so the words stay here.

## Playground

`run-progress.stories.tsx`: every phase, step state and start in the console's words.
