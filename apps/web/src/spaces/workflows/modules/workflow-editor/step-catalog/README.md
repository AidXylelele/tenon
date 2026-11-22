# step-catalog

The workflow editor's step catalog: what its panel shows under "Add a step" after a "+". A search over the kinds of step the host runs, the "Common" group open and the others closed with their counts; the person moves with ↑ and ↓ and adds with Enter or a click, and the part tells the editor what the chosen entry does. The panel's header (its title, where the step will go and Close) is the editor's. It lives in the editor module because only the workflow editor uses it (the owner's RFC: a feature repeats across domains; one page's logic stays in its module).

Owner: web — editor. Decisions: research D2 and D10 of the console redesign (005); information architecture §7 "The step catalog"; design system §6 "Step catalog" and §7 "Command menu (⌘K), step catalog, workflow filter"; the approved mockup's `CATALOG`, `catalogPanel`, `catalogList` and `catalogFlat`, with the evaluation's fixes M-21, M-31 and E1.

## API

`StepCatalog` with:

- `variants`: the kinds of step the host runs (the language server's `workflow/stepVariants`); an entry whose variant is missing is not offered.
- `stepAbove`: the title of the step above the "+", or `null` where none is (right after the start, first on a branch or in a block); "Retry a step if it fails" is offered only below a step and names it.
- `languageTerms`: the person asked for the language's terms; every entry then shows its term (`call: http`). Otherwise a term shows only beside the active or hovered entry and beside an entry the search found by its term.
- `onChoose(action)`: the chosen entry's `EntryAction` — `{ kind: "insertStep", variant }`, `{ kind: "setFailure", failure }` for the step above (three retries, 2 s apart, growing), or `{ kind: "changeStart" }`, which opens the start form. Selecting the added step and focusing its first empty field is the editor's.

## The catalog's words and search (`catalog.ts`, `search.ts`)

- `catalogOf(variants, stepAbove)`: the groups at a "+": "Common" first, then "Decide and repeat", "Run code", "Wait and events" and "For developers". An entry whose variant the host does not run is absent; a group left empty is absent; "Change how the workflow starts" is always there.
- An entry (`CatalogEntry`): `id`, `title`, `description`, `example`, `synonyms`, `languageTerm`, `icon` (a Lucide name, drawn by `entry-icons.ts`) and `action`.
- `shownGroupsOf(catalog, query, opened)`: an entry matches when every word of the query is in its title, language term or synonyms, in any case. With a query every group is open; without one, "Common" and the groups in `opened`. A shown entry says whether the query is in its language term (`termMatched`).
- `keyboardOrderOf(groups)`: the entries ↑ and ↓ move through, those of the open groups in order.
- `entryWordsOf(entry, stepAbove)`: "Retry a step if it fails" names the step above ("Retry “Fetch the digest” if it fails") and says that it wraps it in a Try.
- `noMatchOf(query)`: the note when nothing matches, with the hint for Slack, Teams, Discord, email and chat. `foundText(count)`: the count said politely as the person types.

## Behaviour

- The search takes focus on open. It is cmdk's combobox (`libs/ui` Command) over one listbox named "Kinds of step"; the open groups are named groups inside it, the first entry is active, and the active entry carries the accent bar and the focus ring.
- The closed groups are `libs/ui` buttons outside the listbox, each named by its title and count ("Decide and repeat, 3 kinds of step"); opening one lists its entries and returns focus to the search.
- While the person searches, the count of matches is said politely; a search that matches nothing shows the note in `libs/ui`'s Empty, with the Slack and email hint. The count stays in the part's own polite region until the app-wide announcer of `libs/ui` lands.

## Playground

`step-catalog.stories.tsx`: after a step, on a branch, with no step above (after the start or first in a block: no retry entry), a host without shell or container, with language terms, a search with no match and a keyboard-active entry. Each story shows what the catalog told the editor.

## Tests

`catalog.test.ts` and `search.test.ts` pin the words and the search; `step-catalog.test.tsx` runs the panel in jsdom; `e2e/step-catalog.spec.ts` checks the search, Enter and the terms' visibility on the built Playground, and `e2e/accessibility.spec.ts` checks every story with axe in both themes. Coverage floor: 85 %.
