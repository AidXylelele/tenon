# step-catalog

The panel that opens on a "+" in the editor: "Add a step", where the step will go, a search over the kinds of step the host runs, the "Common" group open and the others closed with their counts. The person moves with ↑ and ↓ and adds with Enter or a click; the feature tells its owner what the chosen entry does. The words, groups and search are the `step-catalog` operation's; this feature draws them.

Owner: web — editor. Decisions: research D2 and D10 of the console redesign (005); information architecture §7 "The step catalog"; design system §6 "Step catalog" and §7 "Command menu (⌘K), step catalog, workflow filter"; the approved mockup's `catalogPanel`, `catalogList` and `catalogFlat`.

## API

`StepCatalog` with:

- `variants`: the kinds of step the host runs (the language server's `workflow/stepVariants`); an entry whose variant is missing is not offered.
- `stepAbove`: the title of the step above the "+", or `null` where none is (right after the start, first on a branch or in a block); "Retry a step if it fails" is offered only below a step and names it.
- `place`: where the step will go, in words, shown under "Add a step": "after Fetch the digest", "on the branch “has items” of Has items?", "inside Prepare the batch".
- `languageTerms`: the person asked for the language's terms; every entry then shows its term (`call: http`). Otherwise a term shows only beside the active or hovered entry and beside an entry the search found by its term.
- `onChoose(action)`: the chosen entry's `EntryAction` — `{ kind: "insertStep", variant }`, `{ kind: "setFailure", failure }` for the step above, or `{ kind: "changeStart" }`. Selecting the added step and focusing its first empty field is the owner's.
- `onClose()`: the panel's Close button.

## Behaviour

- The search takes focus on open. It is cmdk's combobox (`libs/ui` Command) over one listbox named "Kinds of step"; the open groups are named groups inside it, the first entry is active, and the active entry carries the accent bar and the focus ring.
- The closed groups are buttons outside the listbox, each named by its title and count ("Decide and repeat, 3 kinds of step"); opening one lists its entries and returns focus to the search.
- While the person searches, the count of matches is said politely ("1 kind of step", "No kind of step matches"); a search that matches nothing shows the operation's note, with the Slack and email hint.

## Playground

`step-catalog.stories.tsx`: after a step, on a branch, inside a block, with no step above (no retry entry), a host without shell or container, with language terms, a search with no match and a keyboard-active entry. Each story shows what the catalog told the editor.

## Tests

`step-catalog.test.tsx` runs the panel in jsdom; `e2e/step-catalog.spec.ts` checks the search, Enter and the terms' visibility on the built Playground, and `e2e/accessibility.spec.ts` checks every story with axe in both themes.
