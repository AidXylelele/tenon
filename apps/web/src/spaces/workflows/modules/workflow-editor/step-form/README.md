# step-form

The editor panel's form of one step, and the start form ("How it starts"): a part of the workflow editor module, the only page that uses them. It renders the language server's `workflow/stepForm` and `workflow/workflowForm` in the design's words and reports every change as `workflow/edit` actions. Its logic, without JSX, is the module's `form-fields`; the data picker, the condition builder and the script editor (F6) reach it through slots the editor fills.

Owner: web — editor. Sources: research D2, D9, D13, D14, D15, D16 of the console redesign (005); information architecture §Editor and §14; design system §6 (forms, segmented controls, radios) and §7 (labels above, help under the label, the error beside the field after it is left, "Fill in" in amber until the field is left or Test or Publish is pressed); the approved mockups `formHttp`, `formSwitch`, `condCard`, `formStart`, `formScript`, `formGeneric`, `failBox`, `moreBox`.

## API

`StepForm` (`StepFormProps`):

- `step`: the step of `workflow/structure` (`id`, `pointer`, `name`, `kind`).
- `form`: `workflow/stepForm` of that step.
- `protection`: `workflow/stepForm` of the try that protects the step (a try whose list holds only it), else `null`; "If this step fails" reads and sets the failure there.
- `revealProblems`: `true` once Test run or Publish has been pressed; every problem then shows as an error at once.
- `languageTerms`: shows each field's place in the text beside its label.
- `onEdit(actions)`: the `workflow/edit` actions to apply in order, each on the text the previous one leaves; never empty.
- Slots, each optional, filled by the module: `renderData(slot)` for a field that takes data (`DataSlot`: the field's `pointer` and `value`, the input's `inputId`, `describedBy`, `invalid`, `placeholder`, and `onText(text)`, `onUse({ value, export })`, `onTemplate(parts, use)`, `onClear()`), `renderCondition(slot)` for a condition (`ConditionSlot`: `pointer`, `text`, `required`, `labelledBy`, `describedBy`, `invalid`, and `header`, the branch card's header where the builder puts "Write an expression"; a switch's branch, required, and "Run only if", optional), `renderCode(slot)` for a script's code (`CodeSlot`: the `field`, its `language`, `labelledBy`, `describedBy`). Without a slot the field is plain text. `blurOnEnter`: the one Enter-leaves-the-field handler the editor's parts share.

The form shows the name, the essential fields, the step's result where the language server offers a choice (a set's "Keep the data that came in", a script's "The step's result", right after the code), then "More options" (shown only when it holds something), "If this step fails" and, while language terms are shown, "Data in and out" (stop · retry, then stop · retry, then run other steps · continue with the next step · run other steps instead, with the retry's settings). A switch shows its branches as cards, each with its condition, its destination, the problems the language server reports inside that case, and move or remove; "Otherwise" ends the run or goes on.

`StartForm` (`StartFormProps`): `form` (`workflow/workflowForm`), `webhooks` (`name`, `eventType`, `address`), `now` (an ISO instant) and `zone` (an IANA name) for the local time beside the UTC schedule, `revealProblems`, `languageTerms`, `onEdit`. By hand, on a schedule (repeat, time in UTC, days, minutes, or a cron; the viewer's time, the daylight-saving note and the next three starts), by a webhook (its address to copy) or by an event type; the workflow's input under "Workflow input".

Consumer: the workflow editor's panel, which replaces the old `step-inspector` with these in M5.

A member the grammar leaves for a person to name (`suggested`: headers, query, arguments, environment) is offered as rows to add. An HTTP call's Authentication (More options) is None, a bearer token or a user name and password from a secret, written whole at `with/endpoint/authentication`. The time limit shows the language server's `timeout` in seconds, whatever form it is written in. An HTTP call's data says how it is sent ("Send as": Message, the usual, written as `{ "text": … }`; JSON; Form fields, named values with their content type), and its headers are named values. A field is "optional" only when it is not required, has no fill words and no usual value (a choice, after this step, a method, a language, a time limit). Errors carry a circle-alert icon; placeholders are faint.

## Playground

`step-form.stories.tsx`: an HTTP step's essentials, its more options, an address to fill and the problem after leaving it, language terms, a switch's branches, set data keeping the incoming data, a script's result, a wait, set data whose values are references shown as chips, failure handling with retry settings, and composed as the editor composes them: an HTTP step with the data picker, a switch with the condition builder and with an expression. `start-form.stories.tsx`: a schedule, one before daylight saving, a weekly schedule, a webhook, an event to fill, and by hand without webhooks.
