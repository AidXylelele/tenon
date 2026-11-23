# automatic-starts

The switch that turns a workflow's automatic starts on and off, with its state in words, a toast with Undo after a change and a refusal said beside it. Business UI: the page passes the command as `turn`.

Owner: web — runs. Decisions: design system §7 (Switch only for immediate on/off; `role=switch`, the label names what it switches; an Undo after a change); information architecture §5 (A workflow, Home "Starts automatically").

## API

- `<AutomaticStarts workflow on turn disabled labelled />`: `workflow` names the workflow in the toasts; `turn(on)` is the server action that turns it; `labelled` shows "Starts automatically" beside the switch, otherwise the switch is named "{workflow} starts automatically" for a table whose column says what it is.

## Consumers

A workflow's page (labelled) and Home's "Starts automatically" table.

## Playground

`automatic-starts.stories.tsx`: on, off, in a table and refused.
