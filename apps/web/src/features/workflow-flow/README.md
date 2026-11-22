# workflow-flow

The workflow drawn top to bottom from its document: the start, the steps in order, blocks framed around their steps, branches of a fork side by side, the branches of a choice as rows on its card, a jump as a dashed connector to its target, and the end. One view for editing a draft, for reading a version and for following a run. Business UI with its logic: it gets the language server's structure and the state of each step as props and reports what the person asks for through callbacks; it never talks to the language server.

Owner: web — editor. Decisions: research D1, D9, D10 and D12 of the console redesign (005); information architecture §4 (step statuses), §5 "Editor" and "A run", §14; design system §5 (icons), §6 (Step card, Flow view) and §7 (Flow canvas, focus destinations); the approved mockup's `renderTree`, `seq`, `block`, branch rows, the Try lane, the start card, the End node and the zoom controls.

## API

`<WorkflowFlow workflow mode selected onSelect />`, filling its container; the canvas scrolls inside it, never the page.

- `workflow`: the language server's `WorkflowStructure` (`workflow/structure`).
- `selected`: the step id on show, or `START` for the start; `onSelect(target)` with a step id, `START`, or `null` (Escape). Without `onSelect` the cards are not controls (a version read on its own).
- `mode`, one of:
  - `{ kind: "read" }`: no "+" and no menus.
  - `{ kind: "edit", marks, inserting, onInsert, onEdit }`:
    - `marks`: by step id, `{ kind: "problem", count, message }` ("1 problem: the address is missing", a red outline) or `{ kind: "fill", what }` ("Fill in: the address", amber until the module turns it into a problem).
    - `onInsert(place)` from every "+": `{ kind: "list", list, index, above }` for `insertStep` (`above` is the name of the step above it, the step catalog's `stepAbove`), or `{ kind: "branch", switch, case }` for `insertStepOnBranch`. `inserting` is the place whose catalog is open; its "+" is marked.
    - `onEdit(edit)` from the selected step's menu, an `EditAction` ready to send: `duplicateStep`, `moveStep` up or down in its list, `wrapSteps` in a `try`, a `for` or a `do`, `removeStep`.
  - `{ kind: "run", start, steps, ended, onIteration }`:
    - `start`: the start card's words for this run (`title`, `detail`).
    - `steps`: by step id, `{ status, detail, branch?, iteration? }`. `status` is a phase or `retrying` or `skipped`, shown in the console's words (Queued, Running, Waiting, Paused, Succeeded, Failed, Cancelled, Retrying, Skipped); `detail` follows it ("189 ms", "attempt 2 of 3"). A step with no entry was not reached: its card is dashed and muted and the connector into it is dashed. `branch` is the case a choice took; `iteration` (`shown`, `count`) puts "Iteration ‹ 3 of 3 ›" on a repeat, and `onIteration(step, n)` asks for another.
    - `ended`: the run reached the end; otherwise the end reads "Not reached".
- `START`: the start's id.

## Built from

`FlowCanvas` (`libs/flow`: the scrolling, zooming canvas and its zoom control), `IconButton` and `useRovingFocus` (`libs/ui`), the design system's `Button`, `DropdownMenu`, `Status` and `Tooltip`, and `schedule-words` for the start in words.

## Decisions

- **The browser lays the flow out, not ELK.** The document is a tree of lists: a list is a column, a block a frame around its lists, a fork's branches columns side by side. CSS flexbox (W3C, CSS Flexible Box Layout Level 1) places exactly that from the DOM the accessibility tree needs anyway, with the cards' real text sizes, in one pass. ELK's layered layout would need every card measured first, then a worker round trip per edit, and would only reproduce the column (the old canvas's 700 lines of graph and port code). Only jumps leave the tree, and they never leave their list, so they are drawn from the measured boxes. "Auto-laid out" (research D1) holds: nothing is placed by hand and no position is stored.
- **Plain elements, not React Flow nodes.** React Flow renders every node as a sibling in one `.react-flow__nodes` layer, so a block could not hold its steps in the DOM and the accessibility tree (design system §7, evaluation M-17); its viewport pans by transform with no scrollbars, while the design keeps the canvas's scrollbars as the single-pointer alternative to dragging (resolution M-91, WCAG 2.2 SC 2.5.7).
- **Selection without status fills.** A selected card has the accent border, ring and bar; it is filled only while editing, since status words never sit on a fill (design system §6).
- **Kinds in words by the language's task kind.** The structure carries `kind`, not the catalog's variant, so a call reads "Call a service" and a run "Run code" until the structure names the variant.

## Behaviour

- **Layout.** A jump is drawn out of the source's right edge, down or up beside the widest step between, into the target's right edge; the target says where it comes from ("from Has items? · Otherwise").
- **Where the flow continues.** A step continues to the next one when it ends with `continue`; a choice when one of its cases continues, or when it has no default case and continues itself. A step that does not continue says how it leaves at its foot ("End the run", "Leave the block", "go to Retry") and has no connector below it.
- **"+"** sits on every connector, at the end of every block's list and on every branch row; an empty list shows "No steps inside yet" and its "+".
- **Zoom.** Zoom in, zoom out and fit, pinned in the canvas. The flow opens fitted to the canvas's width, never above 100 %, and scrolls inside the canvas; fit shows all of it, never above 100 %.
- **Keyboard.** The flow is one Tab stop (a roving tabindex): the control last focused, else the selected step, else the start, else the first control. ↑ ← and ↓ → move between the steps, the "+" buttons and the other controls in the document's order; Home and End go to the first and the last; Enter and Space press; Escape clears the selection. Tab leaves for the zoom controls. A version read on its own has no controls, so its canvas is the Tab stop and scrolls by the keyboard.
- **Accessibility tree.** The canvas is a section named for what it shows; a step is a group named by its kind and name, holding the button that selects it; a block is a group that holds its steps; a choice's branches are a list; a fork's branch and the Try's "If it fails" lane are named groups; the selected step is `aria-current`. Every icon-only control has a name and a tooltip with the same words; every target is at least 24 × 24 px at full size. Status is a word and an icon, never colour alone.
- **Focus.** Selecting a step keeps focus on it; deleting a step from its menu moves focus to the "+" above it.

## Playground

`workflow-flow.stories.tsx`: editing with problems and fill-ins, an empty workflow, the four blocks with the Try lane, an empty block, a choice with branches and jumps, a failed run, a run with a repeat's iterations, a run in progress, a wide fork in the canvas of a 1024 px editor, and a version read on its own. `e2e/workflow-flow.spec.ts` is its smoke test against the built Playground.
