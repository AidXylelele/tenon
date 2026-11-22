# LSP extensions

This document describes the custom methods of the workflow language server, in the form of rust-analyzer's `lsp-extensions.md`. Each type is declared once, beside the code in `src/ide` that builds it, and `src/protocol` exports it, with the LSP's `Range` and `Diagnostic` where it carries them.

- **Phase.** A custom request is answered by the server's phase, as a standard one is: `ServerNotInitialized` (-32002) before `initialize` is answered, and `InvalidRequest` (-32600) after `shutdown`.
- **Faults.** A fault inside a request answers `InternalError` (-32603).

## Initialization options

The client sends these with `initialize`:

```typescript
interface InitializationOptions {
  profile: HostProfile; // the interpreter's: what the host runs
  draft?: { namespace: string; name: string }; // the draft the editor holds
}
```

- **Refused** with `InvalidParams` (-32602) and no retry when the profile is not of the interpreter's shape, or the draft is not a namespace and a name.
- **The draft's address.** Where the document's `namespace` or `name` differs from the draft's, the server reports a `draft-address` diagnostic at the first that differs ("This draft is sales/lead-intake, and the document names orders/greet; publishing it here is refused."), so `workflow/document` refuses as the API's publish would. Its quick fix (`textDocument/codeAction`, `quickfix`) is "Use sales/lead-intake", which writes both; `setField` at `/document/namespace` and `/document/name` does the same through `workflow/edit`.

## Document

**Method:** `workflow/document`

The client sends this request to read a version of an open document as the JSON value the API compiles, for publishing.

```typescript
interface DocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
}

type DocumentResult =
  | { kind: "document"; version: number; document: JsonValue }
  | { kind: "refused"; version: number; diagnostics: Diagnostic[] };
```

- **The result.** It is `document` when the version analyses with no diagnostic. Otherwise it is `refused`, with the diagnostics the version's push carried.
- **Errors:**
  - `ContentModified` (-32801), "The request names version 1; the document is at version 2.", when the version is not the store's;
  - `RequestFailed` (-32803), "The document file:///none.yaml is not open.";
  - `InvalidParams` (-32602), when the params are of another shape.

**Example:**

```json
{ "textDocument": { "uri": "file:///greet.yaml", "version": 1 } }
```

```json
{
  "kind": "document",
  "version": 1,
  "document": {
    "document": {
      "dsl": "1.1.0",
      "namespace": "test",
      "name": "flow",
      "version": "0.1.0"
    },
    "do": [{ "greet": { "set": { "a": 1 } } }]
  }
}
```

## From JSON

**Method:** `workflow/fromJson`

The client sends this request to turn a document given as a JSON value into YAML text, to open a draft of a version that has no stored source. It names no document and holds no state.

```typescript
interface FromJsonParams {
  document: JsonValue;
}

interface FromJsonResult {
  text: string;
}
```

- **The text.** It is `yaml`'s block style, two spaces to a level, with folding off (`lineWidth: 0`), so no long `${ … }` expression is split across lines. Read back through the analyzer, the text gives the same value.
- **Errors:** `InvalidParams` (-32602), when the params hold no `document`.

**Example:**

```json
{
  "document": {
    "document": {
      "dsl": "1.1.0",
      "namespace": "test",
      "name": "flow",
      "version": "0.1.0"
    },
    "do": [{ "greet": { "set": { "a": 1 } } }]
  }
}
```

```json
{
  "text": "document:\n  dsl: 1.1.0\n  namespace: test\n  name: flow\n  version: 0.1.0\ndo:\n  - greet:\n      set:\n        a: 1\n"
}
```

## New document

**Method:** `workflow/newDocument`

The client sends this request to get the text a new workflow opens on: the smallest document the standard accepts, with the namespace, name and version the author chose. It names no document and holds no state; it is answered once the server runs.

```typescript
interface NewDocumentParams {
  namespace: string;
  name: string;
  version: string;
}

type NewDocumentResult =
  | { kind: "text"; text: string }
  | { kind: "refused"; params: ("namespace" | "name" | "version")[] };
```

- **The text.** `document` with its four members, `dsl` the interpreter's `standardVersion`, and an empty `do`, written by `yaml`; a value YAML would read as another type is quoted.
- **The refusal.** The server analyses the text it writes; where the analysis finds a fault at `/document/namespace`, `/document/name` or `/document/version`, it answers `refused` with those params, in that order, and no text. The client words each field's message.
- **Errors:** `InvalidParams` (-32602), when a param is not a string.

**Example:**

```json
{ "namespace": "sales", "name": "onboarding", "version": "1.0.0" }
```

```json
{
  "kind": "text",
  "text": "document:\n  dsl: 1.1.0\n  namespace: sales\n  name: onboarding\n  version: 1.0.0\ndo: []\n"
}
```

## Ranges of pointers

**Method:** `workflow/rangesOf`

The client sends this request to place JSON pointers in the text of a version, such as the pointers a publish refusal carries, so that it never maps a pointer onto YAML itself.

```typescript
interface RangesOfParams {
  textDocument: VersionedTextDocumentIdentifier;
  pointers: string[];
}

interface RangesOfResult {
  version: number;
  ranges: (Range | null)[]; // one per pointer, in order
}
```

- **Placement.** Each pointer is placed by the interpreter's `rangeOf`, at the nearest node the text holds, as the analysis places a finding. A pointer to a node the text lacks gets the range of its nearest ancestor.
- **A text that does not read.** Every pointer is `null`.
- **Errors:**
  - `ContentModified` (-32801), when the version is not the store's;
  - `RequestFailed` (-32803), when the document is not open;
  - `InvalidParams` (-32602), when the params are of another shape.

**Example:**

```json
{
  "textDocument": { "uri": "file:///flow.yaml", "version": 1 },
  "pointers": ["/do/0/route/switch/0/known/then", "/do/0/route/nowhere"]
}
```

```json
{
  "version": 1,
  "ranges": [
    {
      "start": { "line": 10, "character": 18 },
      "end": { "line": 10, "character": 25 }
    },
    {
      "start": { "line": 7, "character": 6 },
      "end": { "line": 13, "character": 0 }
    }
  ]
}
```

## Imports

**Methods:** `workflow/importsNeeded` (server to client) and `workflow/didFetchImports` (client to server), both notifications

These notifications bring a document the texts of the imports it names: a function at a URI, or a catalog's. Both are notifications, because the client answers every server request with `MethodNotFound`.

```typescript
interface ImportsNeededParams {
  textDocument: TextDocumentIdentifier;
  imports: { reference: string; uri: string }[];
}

interface DidFetchImportsParams {
  textDocument: TextDocumentIdentifier;
  texts: Record<string, string>; // by reference
  failures?: Record<string, string>; // by reference: why the host gave no text
}
```

The loop runs in four steps:

1. **The push, then the ask.** After each push, the server sends one `workflow/importsNeeded` with the imports of the version that have a URI and were not asked for yet. Each reference is asked for once per open document, and nothing goes out when none is new.
2. **The fetch.** The client fetches the texts through the API, under its address policy.
3. **The texts and the failures.** The client sends them with `workflow/didFetchImports`, both keyed by reference: a text for each fetch that succeeded, and in `failures` the host's reason, as text, for each that did not. For an open document, the server keeps them with the document's imports and restarts its pause. The latest outcome for a reference wins: a text replaces an earlier failure, and a failure an earlier text.
4. **The re-analysis.** After the pause, the document re-analyses with the texts and is pushed again. An import's own imports come round in that analysis.

- **Ignored.** Texts for a document not open, or of another shape, are ignored: a notification has no answer.
- **A failed fetch** leaves the `unresolved-import` diagnostic standing, and its message says why: `Import '<reference>' could not be fetched: <reason>`. The client may send the text later.

**Example:**

```json
{
  "textDocument": { "uri": "file:///catalogs.yaml" },
  "imports": [
    {
      "reference": "https://raw.githubusercontent.com/open-workflow-specification/catalog/main/functions/log/1.0.0/function.yaml",
      "uri": "https://raw.githubusercontent.com/open-workflow-specification/catalog/main/functions/log/1.0.0/function.yaml"
    }
  ]
}
```

```json
{
  "textDocument": { "uri": "file:///catalogs.yaml" },
  "texts": {
    "https://raw.githubusercontent.com/open-workflow-specification/catalog/main/functions/log/1.0.0/function.yaml": "input:\n  schema:\n    document:\n      type: object\nset:\n  logged: ${ .message }\n"
  }
}
```

A fetch that failed:

```json
{
  "textDocument": { "uri": "file:///catalogs.yaml" },
  "texts": {},
  "failures": {
    "https://raw.githubusercontent.com/open-workflow-specification/catalog/main/functions/log/1.0.0/function.yaml": "The host answered 404."
  }
}
```

## Structure

**Method:** `workflow/structure`

The client sends this request to read a version's steps for the canvas and the outline: plain data with stable ids and no layout.

```typescript
interface StructureParams {
  textDocument: VersionedTextDocumentIdentifier;
}

interface StructureResult {
  version: number;
  stale: boolean; // true when the version asked for does not analyse
  workflow: WorkflowStructure;
}

interface WorkflowStructure {
  namespace: string | null;
  name: string | null;
  title: string | null;
  triggers: {
    kind: "every" | "cron" | "after" | "on";
    pointer: string;
    summary: string;
    milliseconds: number | null; // every's and after's duration, where fixed
  }[];
  steps: StepList;
}

interface StepList {
  id: string;
  pointer: string;
  role: "sequence" | "branches";
  steps: Step[];
}

interface NestedList extends StepList {
  part: "do" | "for" | "branches" | "try" | "catch" | "foreach";
}

interface Step {
  id: string;
  pointer: string;
  name: string;
  kind: TaskKind;
  family: "flow" | "call" | "data" | "event" | "time" | "error";
  summary: string | null; // one line from what the step writes
  milliseconds: number | null; // a wait's duration, where fixed
  note: string | null; // metadata.note, where it is a string
  range: Range | null; // the whole item; null where a stale step no longer stands
  selectionRange: Range | null; // its name
  lists: NestedList[];
  flow: Transition[];
}

interface Transition {
  on: "done" | "case" | "caught";
  case: string | null;
  when: string | null; // the case's condition, its source
  kind: "next" | "jump" | "exit" | "end";
  to: string | null; // the step id it reaches; null where it leaves the list
}
```

- **Ids.** A step's id is its pointer with each list index removed (`/do/1/guard/try/0/fetch` becomes `/do/guard/try/fetch`); a list's id is its step's id and the list's pointer below the step. A repeated name's second and later occurrences in one list, and everything below them, take `#` and their full pointer (`#/do/1/greet`). A reorder keeps every id; a rename and a move to another list change the ids of the subtree, which `workflow/edit` reports.
- **Broken text.** When the version does not analyse, the steps are those of the last version that did, `stale` is `true`, and each range is placed again by pointer in the current text, or `null` where it no longer stands or the text does not read.
- **Durations.** A trigger's and a wait's `summary` is the duration as written; `milliseconds` is the same duration as a number, whichever form it is written in (`PT1H` and `{ hours: 1 }` both give 3600000), so a client words a number and reads no grammar. It is `null` where the duration is not fixed: a calendar one (`P1M`), an expression, or a mistake.
- **Published versions.** The API reads the same `WorkflowStructure` from `language-server/structure` for a version it holds, every range `null`.
- **Errors:** `ContentModified` (-32801), `RequestFailed` (-32803) when the document is not open, `InvalidParams` (-32602).

**Example**, for the document

```yaml
document:
  dsl: "1.1.0"
  namespace: test
  name: flow
  version: "0.1.0"
do:
  - pause:
      wait: PT1S
      then: greet
  - greet:
      set:
        message: hello
```

```json
{ "textDocument": { "uri": "file:///flow.yaml", "version": 1 } }
```

```json
{
  "version": 1,
  "stale": false,
  "workflow": {
    "namespace": "test",
    "name": "flow",
    "title": null,
    "triggers": [],
    "steps": {
      "id": "/do",
      "pointer": "/do",
      "role": "sequence",
      "steps": [
        {
          "id": "/do/pause",
          "pointer": "/do/0/pause",
          "name": "pause",
          "kind": "wait",
          "family": "time",
          "summary": "PT1S",
          "milliseconds": 1000,
          "note": null,
          "range": {
            "start": {
              "line": 6,
              "character": 2
            },
            "end": {
              "line": 8,
              "character": 17
            }
          },
          "selectionRange": {
            "start": {
              "line": 6,
              "character": 4
            },
            "end": {
              "line": 6,
              "character": 9
            }
          },
          "lists": [],
          "flow": [
            {
              "on": "done",
              "case": null,
              "when": null,
              "kind": "jump",
              "to": "/do/greet"
            }
          ]
        },
        {
          "id": "/do/greet",
          "pointer": "/do/1/greet",
          "name": "greet",
          "kind": "set",
          "family": "data",
          "summary": "message",
          "milliseconds": null,
          "note": null,
          "range": {
            "start": {
              "line": 9,
              "character": 2
            },
            "end": {
              "line": 11,
              "character": 22
            }
          },
          "selectionRange": {
            "start": {
              "line": 9,
              "character": 4
            },
            "end": {
              "line": 9,
              "character": 9
            }
          },
          "lists": [],
          "flow": [
            {
              "on": "done",
              "case": null,
              "when": null,
              "kind": "next",
              "to": null
            }
          ]
        }
      ]
    }
  }
}
```

## Step form

**Method:** `workflow/stepForm`

The client sends this request for the fields of one step, so that the inspector renders them without knowing the language.

```typescript
interface StepFormParams {
  textDocument: VersionedTextDocumentIdentifier;
  step: string; // a step id of workflow/structure
}

interface StepFormResult {
  version: number;
  step: string;
  failure: "stop" | "continue" | "retry" | "handle"; // "If it fails", in force
  fields: FormField[];
}

interface FormField {
  key: string;
  title: string; // a label for people, e.g. "Run only if" for 'if'
  pointer: string; // where its value stands, or would stand
  section: "settings" | "failure" | "data" | "note";
  description: string | null; // of this field; the call's is its task's
  input:
    | "text"
    | "number"
    | "boolean"
    | "choice"
    | "duration"
    | "group"
    | "oneOf"
    | "structured";
  choices: JsonValue[]; // suggestions beside a 'text'
  required: boolean;
  written: boolean;
  value: JsonValue; // null where not written
  fields: FormField[]; // for 'group', 'oneOf' and 'duration'
  diagnostics: Diagnostic[]; // those at or under pointer
}
```

- **Fields** come in the grammar's order. `input, output, export` are `data`, `timeout` and `catch` are `failure`, `metadata` is `note`, and every other member is `settings`.
- **Titles and descriptions.** `title` labels the field for people: the server's own words for the members an author meets most (`if` is "Run only if", `then` "Then go to", `timeout` "Time limit", `call` "Kind of call", `with` "Arguments"), else the key in words (`exceptWhen` is "Except when"). `description` describes the field itself, from the grammar; the grammar describes a call on its task, so the `call` field carries the task's ("Defines the HTTP call to perform.").
- **If it fails.** `failure` is the choice in force for the step: `stop` for a step no try protects; for a protecting try (a try whose `try` list holds one step), `handle` where its `catch` writes `do`, `retry` where it writes `retry`, else `continue`. The web shows it and changes it with `workflow/edit`'s `setFailure`; the retry's own values are the `catch` group's fields.
- **Input.** `choice` where the grammar admits only the values it lists (its `closed` places, such as an HTTP call's `with.output`), with those values as `choices`; else `boolean` or `number` where that is the only type; `text` where a string is admitted and the written value is one or nothing is written, with the grammar's values as suggestions in `choices` (a `then` suggests the flow directives and the names of the step's list); `duration` for the standard's duration, an ISO 8601 text or an object of units, with its `fields` the units `days`, `hours`, `minutes`, `seconds` and `milliseconds`, each a `number` whose `value` is the amount the text gives, whichever form it is written in (`PT1H30M` gives `hours` 1 and `minutes` 30), and `null` where it gives none or what is written is not a duration the units hold (an expression, or a mistake, which the field's diagnostics name); `group` for an object with named members; `oneOf` for an object whose members are alternatives, its `fields` being those alternatives (the workflow form's schedule where the host runs one trigger, below); `structured` otherwise, for the text editor.
- **Duration edits.** A duration is set whole, as an object of units, by `setField` at its pointer, e.g. `{ "minutes": 15 }`, whatever form it was written in.
- **Broken text.** A form stands while the grammar refuses the text, so a mistake is a diagnostic at its field, never a refused form: the fields are read from the text as it stands, and a step is found by the steps of the last version that analysed, where the text still holds it. `setField` and `clearField` act on such a text; the step actions and `setFailure` need a version that analyses.
- **Errors:** `ContentModified` (-32801); `RequestFailed` (-32803) for an unknown step id, a text that does not read, and a document that has never analysed; `InvalidParams` (-32602).

**Example**, on the same document; of the eight fields, `then` and `wait` are shown, and of `wait`'s five units, `seconds`:

```json
{
  "textDocument": { "uri": "file:///flow.yaml", "version": 1 },
  "step": "/do/pause"
}
```

```json
{
  "version": 1,
  "step": "/do/pause",
  "failure": "stop",
  "fields": [
    {
      "key": "then",
      "title": "Then go to",
      "pointer": "/do/0/pause/then",
      "description": "The flow directive to be performed upon completion of the task.",
      "input": "text",
      "choices": ["continue", "exit", "end", "pause", "greet"],
      "required": false,
      "written": true,
      "value": "greet",
      "diagnostics": [],
      "section": "settings",
      "fields": []
    },
    {
      "key": "wait",
      "title": "Wait",
      "pointer": "/do/0/pause/wait",
      "description": "The amount of time to wait.",
      "input": "duration",
      "choices": [],
      "required": true,
      "written": true,
      "value": "PT1S",
      "diagnostics": [],
      "section": "settings",
      "fields": [
        {
          "key": "seconds",
          "title": "Seconds",
          "pointer": "/do/0/pause/wait/seconds",
          "description": "Number of seconds, if any.",
          "input": "number",
          "choices": [],
          "required": false,
          "written": false,
          "value": 1,
          "diagnostics": [],
          "section": "settings",
          "fields": []
        }
      ]
    }
  ]
}
```

## Workflow form

**Method:** `workflow/workflowForm`

The client sends this request for the fields of the workflow itself, the start of the canvas: its header and how it starts.

```typescript
interface WorkflowFormParams {
  textDocument: VersionedTextDocumentIdentifier;
}

interface WorkflowFormResult {
  version: number;
  fields: FormField[]; // the step form's FormField
}
```

- **Fields**, in this order:
  - `/document/title` and `/document/summary`, section `note`;
  - `/document/version`, section `settings`;
  - `/schedule`, section `settings`: its `fields` are the triggers the host runs, `profile.schedules` of the `initializationOptions`, from `every`, `cron`, `after` and `on`, the ways the standard starts a workflow by itself. With `profile.triggers` at `"one"` it is a `oneOf`, the one written being the trigger in force; else it is the standard's `group`, each written trigger in force. With none written the workflow starts by hand or by an application. Each trigger is a field of its own: `every` and `after` are `duration`s, `cron` is `text`, and `on` is a `group` of its event strategy;
  - `/schedule/read`, section `settings`, a `choice` of `data`, `envelope` and `raw`, offered only while `on` is written, since the standard admits it only beside `on`;
  - `/input`, section `data`: a `group` of `schema` and `from`.
- Namespace and name are the draft's address and are not in the form; the structure carries them.
- **Edits.** Each field is written through `workflow/edit` like a step's: `setField` and `clearField` at its pointer, e.g. `setField` at `/schedule/cron` with `"0 9 * * *"`, which writes the schedule too when the text has none. Under a `oneOf`, a trigger the text does not write replaces the one it does: `setField` at `/schedule` with an object of that one member, e.g. `{ "cron": "0 9 * * *" }`, and `clearField` at `/schedule` leaves the workflow to start by hand. A second trigger written under `"one"` is the analysis's `capability` diagnostic at `/schedule`.
- **Errors:** `ContentModified` (-32801); `RequestFailed` (-32803) for a text that does not read; `InvalidParams` (-32602). A text the grammar refuses still has its form, as the step form's.

## Edit

**Method:** `workflow/edit`

The client sends this request to turn a canvas or inspector action into text edits on a version. The edits keep the author's text: they replace only the ranges they must, a moved or duplicated step is the author's own text re-indented, and a new step is its kind's template.

```typescript
interface EditParams {
  textDocument: VersionedTextDocumentIdentifier;
  action: EditAction;
}

type EditAction =
  | {
      kind: "insertStep";
      list: string;
      index: number;
      step: TaskKind;
      name: string | null;
    }
  | {
      kind: "insertStepOnBranch";
      switch: string; // the switch's step id
      case: string; // the branch: a case's name, as Transition.case
      step: TaskKind;
      name: string | null;
    }
  | { kind: "moveStep"; step: string; list: string; index: number }
  | { kind: "removeStep"; step: string }
  | { kind: "renameStep"; step: string; name: string }
  | { kind: "duplicateStep"; step: string }
  | { kind: "setField"; pointer: string; value: JsonValue }
  | { kind: "clearField"; pointer: string }
  | { kind: "setFailure"; step: string; failure: Failure };

type Failure =
  | { kind: "stop" }
  | { kind: "continue" }
  | { kind: "retry"; attempts: number; seconds: number; growing: boolean }
  | { kind: "handle" };

interface EditResult {
  edits: TextEdit[];
  ids: { from: string; to: string }[];
}
```

- **Ids** are the structure's. `index` is the step's index in the target list after the action. `ids` lists every id the action changes: `renameStep`, and `moveStep` into another list, give the step and every step and list below it; the others give none.
- **Names.** A new step without a name takes its kind's name, then `<kind>-2`, `-3`, …; a duplicate takes the next free `<name>-2`.
- **Fields.** `setField` and `clearField` act at any member of a step or of the document, such as `/schedule/cron`. `setField` also writes the holders the text lacks, as an author would: a member added to a block mapping is written in block style, so `setField` at `/input/schema` on a workflow with no `input` writes `input:`, then `schema:` and the value below it; one added to a flow mapping stays on its line.
- **Text with line breaks.** A string with a line break, set in a block mapping or sequence, is written as a literal block scalar indented under its key or dash: `|` when it ends in one line break, `|-` when it ends in none, `|+` when it ends in more, the indentation indicator where its first line starts with a space; a comment after the old value moves to the block's header. A one-line string keeps the style it was written in, a block scalar's included (`code: |-` and the line). In a flow collection a string stays on its line, double-quoted where it holds a line break.
- **A step on a branch** (`insertStepOnBranch`). The new step goes directly after the switch, in the switch's list, because flow directives name only tasks of their own list (dsl.md, "Task Flow") and the only step that can run into that place is the switch itself. Where the branch led stays where it leads, through the new step:

  | The branch's `then` | Its `then` after                  | The new step's `then`                                                               |
  | ------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
  | `continue`          | `continue`, now into the new step | none: it continues to the step that followed the switch, or off the end of the list |
  | a step's name       | the new step's name               | that step's name                                                                    |
  | `end`               | the new step's name               | `end`                                                                               |
  | `exit`              | the new step's name               | `exit`                                                                              |

  Every other way out of the switch that continued now runs into the new step, so it is written out: each other case whose `then` is `continue`, and the switch's own `then` when it continues and no case is the default (a switch with no matching case follows its own `then`). Each names the step that followed the switch; where the switch was its list's last step, `end` in the workflow's own list and `exit` in a nested one, which complete the run and the block as running off their end does. A switch that is a branch of a fork is refused: a step after it would be another branch. `ids` is empty, as for `insertStep`.

- **If it fails** (`setFailure`: `stop`, `continue`, `retry` or `handle`), on a step's id:
  - on a step no try protects, `continue`, `retry` and `handle` wrap the author's step text, re-indented, in a try of the same name, and move the step's `then` to the try; `stop` changes nothing;
  - on a protecting try (a try whose `try` list holds one step), `continue`, `retry` and `handle` replace its `catch`, and `stop` gives the step its own text back in the try's place, with the try's `then`;
  - the `catch` written: `continue` `{}`; `retry` `{ retry: { delay: { seconds }, backoff: { constant: {} } or { exponential: {} } when growing, limit: { attempt: { count: attempts } } } }`; `handle` `{ do: [] }`, an empty list the web fills with `insertStep` into `<id>/catch/do`; a `handle` on a try whose catch already writes `do` changes nothing;
  - `ids`: wrapping moves the step and everything below it under `<id>/try` (`/do/greet` to `/do/greet/try/greet`); unwrapping moves them back; the try keeps the step's former id.
- **Errors:**
  - `ContentModified` (-32801), when the version is not the store's;
  - `RequestFailed` (-32803), with its reason, for a step action or `setFailure` on a version that does not analyse, a field action on a text that does not read, an unknown step or list id, an index outside the list, a step on a branch of a step that is not a switch, of a branch the switch does not have, or of a switch that is a fork's branch, a move into the step's own lists, an empty name, a flow directive as a name, a name a sibling has, a field below a value that holds no object, and a field to clear that is not written;
  - `InvalidParams` (-32602), when the params are of another shape.

**Example:**

```json
{
  "textDocument": { "uri": "file:///flow.yaml", "version": 1 },
  "action": { "kind": "renameStep", "step": "/do/guard", "name": "shield" }
}
```

```json
{
  "edits": [
    {
      "range": {
        "start": { "line": 9, "character": 4 },
        "end": { "line": 9, "character": 9 }
      },
      "newText": "shield"
    },
    {
      "range": {
        "start": { "line": 25, "character": 18 },
        "end": { "line": 25, "character": 23 }
      },
      "newText": "shield"
    }
  ],
  "ids": [
    { "from": "/do/guard", "to": "/do/shield" },
    { "from": "/do/guard/try", "to": "/do/shield/try" },
    { "from": "/do/guard/try/fetch", "to": "/do/shield/try/fetch" },
    { "from": "/do/guard/catch/do", "to": "/do/shield/catch/do" },
    { "from": "/do/guard/catch/do/notify", "to": "/do/shield/catch/do/notify" }
  ]
}
```
