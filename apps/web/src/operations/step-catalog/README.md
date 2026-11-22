# step-catalog

The step catalog in the person's words: what "+" in the editor offers, grouped by purpose, each entry with a one-line description, an example, synonyms for the search, its language term and what choosing it does. Business logic without UI: the caller passes the variants the host runs (the language server's `workflow/stepVariants`) and renders what it gets back.

Owner: web — editor. Decisions: research D2 and D10 of the console redesign (005), information architecture §7 "The step catalog"; the wording is the approved mockup's `CATALOG` with the evaluation's fixes M-21, M-31 and E1, and "Run a container" from §7.

## API

- `catalogOf(variants)`: the groups in order, "Common" first, then "Decide and repeat", "Run code", "Wait and events" and "For developers". An entry whose variant the host does not run is absent; "Retry a step if it fails" needs `try`, since its retry waits between attempts; "Change how the workflow starts" is always there. A group left empty is absent.
- An entry (`CatalogEntry`): `id`, `title`, `description`, `example`, `synonyms`, `languageTerm`, `icon` (a Lucide name) and `action`, one of:
  - `insertStep` with the `variant` to insert;
  - `setFailure` with the `Failure` to set on the step above the "+": three retries, 2 s apart, growing;
  - `changeStart`, which opens the start form.
- `shownGroupsOf(catalog, query, opened)`: the groups shown for a search. An entry matches when every word of the query is in its title, language term or synonyms, in any case; a group with no match is absent. With a query every group is open; without one, "Common" and the groups in `opened`. A shown entry says whether every word is in its language term (`termMatched`): the term is then shown beside the title, as it is when the person asks for language terms.
- `keyboardOrderOf(groups)`: the entries ↑ and ↓ move through, those of the open groups in order.
- `entryWordsOf(entry, stepAbove)`: the title and description an entry shows at a "+", given the name of the step above it, or `null` where none is: below a step, "Retry a step if it fails" names that step ("Retry “Fetch the digest” if it fails") and says that it wraps it in a Try.
- `noMatchOf(query)`: the note when nothing matches, with the hint for Slack, Teams, Discord, email and chat.
- `foundText(count)`: the count announced politely as the person types.

## Playground

`step-catalog.stories.tsx`: Tenon's host and a host without `shell` and `container`, with the search box, ↑, ↓ and Enter.
