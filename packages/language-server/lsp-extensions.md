# LSP extensions

This document describes the custom methods of the workflow language server, in the form of rust-analyzer's `lsp-extensions.md`. Each type is declared once, beside the code in `src/ide` that builds it, and `src/protocol` exports it, with the LSP's `Range` and `Diagnostic` where it carries them.

- **Capabilities.** `initialize` answers each custom method's name as a flag under `ServerCapabilities.experimental`, e.g. `"workflow/structure": true`.
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
  variant: StepVariant | null; // its catalog entry (workflow/stepVariants); null for a call of a function
  family: "flow" | "call" | "data" | "event" | "time" | "error";
  summary: string | null; // one line from what the step writes; empty parts left out
  milliseconds: number | null; // a wait's duration, where fixed
  note: string | null; // metadata.note, where it is a string
  range: Range | null; // the whole item; null where a stale step no longer stands
  selectionRange: Range | null; // its name
  lists: NestedList[];
  flow: Transition[];
  catch: CatchPolicy | null; // a try's; null for every other step
}

interface CatchPolicy {
  errors: {
    type: string | null;
    status: number | null;
    instance: string | null;
    title: string | null;
    detail: string | null;
  } | null; // null: any error
  when: string | null; // the catch's condition, its source
  exceptWhen: string | null;
  retry: {
    retries: number | null; // limit.attempt.count: the language counts retries; null: no count is written, so it retries until its duration limit, if any
    milliseconds: number | null; // the delay: 0 where none is written; null where it is not fixed (calendar, expression, mistake)
    backoff: "constant" | "linear" | "exponential";
    when: string | null;
    exceptWhen: string | null;
  } | null;
  afterward: "stop" | "continue" | "handle"; // once the retries are spent, or at once with no retry
}

interface Transition {
  on: "done" | "case" | "caught";
  case: string | null;
  when: string | null; // the case's condition, its source
  condition: ConditionReading | null; // a case's condition as workflow/readCondition reads it; null for a default case and every other way
  kind: "next" | "jump" | "exit" | "end";
  to: string | null; // the step id it reaches; null where it leaves the list
}
```

- **Ids.** A step's id is its pointer with each list index removed (`/do/1/guard/try/0/fetch` becomes `/do/guard/try/fetch`); a list's id is its step's id and the list's pointer below the step. A repeated name's second and later occurrences in one list, and everything below them, take `#` and their full pointer (`#/do/1/greet`). A reorder keeps every id; a rename and a move to another list change the ids of the subtree, which `workflow/edit` reports.
- **Broken text.** When the version does not analyse, the steps are those of the last version that did, `stale` is `true`, and each range is placed again by pointer in the current text, or `null` where it no longer stands or the text does not read.
- **Summaries.** A summary joins what the step writes and leaves out what is still empty: an HTTP call with no address yet is `GET`, a container with no image `container`, a loop with no list yet its item's name, and a call that writes none of its parts has no summary.
- **Conditions.** A case's `condition` is its `when` read as `workflow/readCondition` reads the field's text: rows and a join where the text is in the builder's one form (an empty `when` has no row yet), else `expression` with the text, so the client words the condition or shows it as written.
- **A try's catch.** `catch` gives the policy the interpreter runs: which errors it catches (`errors`, `when`, `exceptWhen`), the retry, its own or a named one of `use.retries`, and `afterward`, what follows once the retries are spent or at once with no retry: `stop` where a retry has neither `catch.do` nor `catch.then` (the error is raised again), `handle` where `catch.do` runs, else `continue`; a `catch.then` is the step's `caught` transition. So "Retry on 503: 3 times, 2 s apart, growing; then stop" is `{ errors: { status: 503, … }, retry: { retries: 3, milliseconds: 2000, backoff: "exponential" }, afterward: "stop" }`.
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
          "variant": "wait",
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
              "condition": null,
              "kind": "jump",
              "to": "/do/greet"
            }
          ],
          "catch": null
        },
        {
          "id": "/do/greet",
          "pointer": "/do/1/greet",
          "name": "greet",
          "kind": "set",
          "variant": "set",
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
              "condition": null,
              "kind": "next",
              "to": null
            }
          ],
          "catch": null
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
  result: {
    value: StepResult; // what the step passes on, as written
    choices: ChosenResult[];
  } | null; // null where the step offers no choice
  fields: FormField[];
}

type ChosenResult =
  | "printedJson"
  | "printedText"
  | "exitCode" // a script
  | "inputAndValues"
  | "valuesOnly"; // a set

type StepResult = ChosenResult | "written"; // "written": none of the choices

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
  essentialRank: number | null; // its place among the essential fields, from 0
  fields: FormField[]; // for 'group', 'oneOf' and 'duration'
  diagnostics: Diagnostic[]; // those at or under pointer
}
```

- **Fields** come in the grammar's order. `input, output, export` are `data`, `timeout` and `catch` are `failure`, `metadata` is `note`, and every other member is `settings`.
- **Essential fields.** A field with an `essentialRank` is shown first, in rank order, with its own `fields`; every other field is behind "More options", where a field that holds essential ones shows only the rest. They are at most five per step, by its variant (`workflow/stepVariants`): an HTTP call's `with.method`, `with.endpoint`, and `with.body` where the method sends one (`post`, `put`, `patch`); an OpenAPI call's description address, operation and parameters; a gRPC call's proto address, service name and host, method and arguments; an AsyncAPI call's document address, operation and message; an MCP call's server address and parameters; an A2A call's server and parameters; a call of a function, its `with`; a script's language, code and arguments; a shell's command; a container's image and command; another workflow's namespace, name, version and input; an emit's event type and data; a for's list and item name; a fork's branches and `compete`; a listen's `to`; a raise's error title, type and status; a set's values; a switch's cases; a try's `catch.retry` and `catch.do`; a wait's duration; a `do`, none. In the workflow form they are `/document/title` and `/schedule`. Below the second level a group is one `structured` field, unless it holds an essential field: then it is a `group` opened down to it (a script's `run.script` holds `language` and `code`).
- **The step's result.** A script offers what it passes on: `printedJson`, the JSON it prints (its `output.as` is `${ fromjson }`, the run returns what it prints); `printedText`, the text it prints (no `output.as`); `exitCode` (`run.return: code`, no `output.as`). A set offers `inputAndValues`, the data that came in with its values beside it (`output.as: ${ $input + . }`, research D13; jq adds an object only to an object or `null`, so the step fails at run time on any other input, and `workflow/dataAt` warns where its input is not known to be an object), or `valuesOnly`, its values alone, as the language passes them on (dsl.md, "Data Flow", step 5). Anything else written is `written`, and the client shows the fields as they stand. It is changed with `workflow/edit`'s `setResult`.
- **Titles and descriptions.** `title` labels the field for people: the server's own words for the members an author meets most (`if` is "Run only if", `then` "Then go to", `timeout` "Time limit", `call` "Kind of call", `with` "Arguments"), else the key in words (`exceptWhen` is "Except when"). `description` describes the field itself, from the grammar; the grammar describes a call on its task, so the `call` field carries the task's ("Defines the HTTP call to perform.").
- **If it fails.** `failure` is the choice in force for the step: `stop` for a step no try protects; for a protecting try (a try whose `try` list holds one step), `handle` where its `catch` writes `do`, `retry` where it writes `retry`, else `continue`. The web shows it and changes it with `workflow/edit`'s `setFailure`; the retry's own values are the `catch` group's fields.
- **Input.** `choice` where the grammar admits only the values it lists (its `closed` places, such as an HTTP call's `with.output`), with those values as `choices`; else `boolean` or `number` where that is the only type; `text` where a string is admitted and the written value is one or nothing is written, with the grammar's values as suggestions in `choices` (a `then` suggests the flow directives and the names of the step's list); `duration` for the standard's duration, an ISO 8601 text or an object of units, with its `fields` the units `days`, `hours`, `minutes`, `seconds` and `milliseconds`, each a `number` whose `value` is the amount the text gives, whichever form it is written in (`PT1H30M` gives `hours` 1 and `minutes` 30), and `null` where it gives none or what is written is not a duration the units hold (an expression, or a mistake, which the field's diagnostics name); `group` for an object with named members; `oneOf` for an object whose members are alternatives, its `fields` being those alternatives (the workflow form's schedule where the host runs one trigger, below); `structured` otherwise, for the text editor.
- **Duration edits.** A duration is set whole, as an object of units, by `setField` at its pointer, e.g. `{ "minutes": 15 }`, whatever form it was written in.
- **Broken text.** A form stands while the text is wrong, so a mistake is a diagnostic at its field, never a refused form: a value the grammar does not admit is a diagnostic of a version that still analyses; where the grammar refuses the text's structure, the fields are read from the text as it stands and a step is found by the steps of the last version that analysed, where the text still holds it. `setField` and `clearField` act on such a text; the step actions and `setFailure` need a version that analyses.
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
  "result": null,
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
      "essentialRank": null,
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
      "essentialRank": 0,
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
          "essentialRank": null,
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
- **Errors:** `ContentModified` (-32801); `RequestFailed` (-32803) for a text that does not read; `InvalidParams` (-32602). A text whose structure the grammar refuses still has its form, as the step form's.

## Step variants

**Method:** `workflow/stepVariants`

The client sends this request for the variants of a step the host runs, to list them in the step catalog. It has no params, names no document and holds no state. The catalog's words (labels, descriptions, synonyms, groups) are the client's: the server names variants only.

```typescript
type StepVariant =
  | "http"
  | "openapi"
  | "grpc"
  | "asyncapi"
  | "mcp"
  | "a2a" // call
  | "script-js"
  | "script-python"
  | "shell"
  | "container"
  | "workflow" // run
  | "do"
  | "emit"
  | "for"
  | "fork"
  | "listen"
  | "raise"
  | "set"
  | "switch"
  | "try"
  | "wait";

interface StepVariantsResult {
  variants: StepVariant[]; // those the host runs, in this order
}
```

- **Support.** A variant is listed when its starting content, analysed alone under the `profile` of the `initializationOptions`, has no `capability` diagnostic: what a host provides is the interpreter's rule, so `grpc` is left out where `profile.effects` lacks `grpc`, `mcp` where `profile.mcpTransports` lacks `http` (its starting transport), `container` where `profile.processes` lacks it, `script-python` where `profile.scriptLanguages` lacks `python`, and `wait` and `try`, whose retry waits between attempts, where `profile.effects` lacks `timer`.
- **Starting content.** Each variant inserts the smallest document the language accepts for it, with the values a person fills left empty rather than made up. The analysis names most of them on a model it still builds, so the new step is in the structure and its form at once: an empty address, operation, service, method, image or workflow (`schema`), an empty event type (`event-attribute`) and an empty `for.in` or condition (`expression`); an empty shell command, script code or error title is accepted as written, and the client marks those fields to fill:

  | Variant                      | Starting content                                                                                                                                                                                                                                                 | Left to fill                                 |
  | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
  | `http`                       | `call: http`, `with: { method: get, endpoint: "" }`                                                                                                                                                                                                              | the address                                  |
  | `openapi`                    | `call: openapi`, `with: { document: { endpoint: "" }, operationId: "" }`                                                                                                                                                                                         | the description's address, the operation     |
  | `grpc`                       | `call: grpc`, `with: { proto: { endpoint: "" }, service: { name: "", host: "" }, method: "" }`                                                                                                                                                                   | the proto's address, the service, the method |
  | `asyncapi`                   | `call: asyncapi`, `with: { document: { endpoint: "" }, operation: "", message: {} }`                                                                                                                                                                             | the document's address, the operation        |
  | `mcp`                        | `call: mcp`, `with: { method: tools/call, parameters: { name: "" }, transport: { http: { endpoint: "" } } }`                                                                                                                                                     | the server's address, the tool               |
  | `a2a`                        | `call: a2a`, `with: { method: message/send, server: "" }`                                                                                                                                                                                                        | the agent's address                          |
  | `script-js`, `script-python` | `run.script` in the language, with code that prints its result as JSON, and `output.as: ${ fromjson }`, which turns the printed text into data                                                                                                                   | the code                                     |
  | `shell`                      | `run.shell.command: ""`                                                                                                                                                                                                                                          | the command                                  |
  | `container`                  | `run.container.image: ""`                                                                                                                                                                                                                                        | the image                                    |
  | `workflow`                   | `run.workflow: { namespace: "", name: "", version: "" }`                                                                                                                                                                                                         | the workflow                                 |
  | `do`                         | `do: []`                                                                                                                                                                                                                                                         | its steps                                    |
  | `fork`                       | two branches, `branch-1` and `branch-2`, each `do: []`                                                                                                                                                                                                           | their steps                                  |
  | `emit`                       | `emit.event.with.type: ""`                                                                                                                                                                                                                                       | the event type                               |
  | `for`                        | `for: { each: item, in: "" }`, `do: []`                                                                                                                                                                                                                          | the list (an `expression` problem)           |
  | `listen`                     | `listen.to.one.with.type: ""`                                                                                                                                                                                                                                    | the event type                               |
  | `raise`                      | `raise.error: { type: …/errors/validation, status: 400, title: "" }`                                                                                                                                                                                             | the title                                    |
  | `set`                        | `set: { value: "" }` and `output.as: ${ $input + . }`, which keeps the data that came in beside the values set                                                                                                                                                   | the values                                   |
  | `switch`                     | `switch: [ { branch-1: { when: "", then: continue } }, { default: { then: end } } ]`: one branch whose condition is to fill (an `expression` problem), and otherwise `end` in the workflow's own list or `exit` in a nested one, so in a loop only the item ends | the condition                                |
  | `try`                        | `try: []`, `catch` with the retry `setFailure` writes for 3 retries, 2 s apart, growing (waits of 2, 4 and 8 s)                                                                                                                                                  | its steps                                    |
  | `wait`                       | `wait: PT30M`                                                                                                                                                                                                                                                    |                                              |

- **Errors:** none of its own; the phase errors of every custom request.

**Example:**

```json
{
  "variants": [
    "http",
    "openapi",
    "grpc",
    "asyncapi",
    "mcp",
    "a2a",
    "script-js",
    "script-python",
    "shell",
    "workflow",
    "do",
    "emit",
    "for",
    "fork",
    "listen",
    "raise",
    "set",
    "switch",
    "try",
    "wait"
  ]
}
```

## Data at a step

**Method:** `workflow/dataAt`

The client sends this request for the data a person can use in one field of a step, to list it in the data picker. Each entry carries the jq expression to insert and the field value that holds only it.

```typescript
interface DataAtParams {
  textDocument: VersionedTextDocumentIdentifier;
  step: string; // a step id of workflow/structure
  field: string; // the pointer of the field the data goes into, under the step
  samples?: { [step: string]: JsonValue }; // the last test run's outputs, by step id
  typed?: string; // a field name the person typed, e.g. "items.title"
}

interface DataAtResult {
  version: number;
  entries: DataEntry[];
  warnings: (
    | { kind: "inputNotKnownObject"; step: string }
    | { kind: "mayHoldNothing"; step: string }
    | { kind: "contextNotKnownObject" }
  )[];
}

interface DataEntry extends DataMember {
  source: "step" | "workflowInput" | "variable" | "secret" | "time";
  step: string | null; // the step id of a step's output
  needsExport: boolean; // using it writes the step's export (useData)
  typed: DataMember | null; // the typed field of a step's output
}

interface DataMember {
  name: string;
  expression: string; // jq, e.g. "$context.fetch.items"
  value: string; // the field holding only it, e.g. "${ $context.fetch.items }"
  isPath: boolean; // the expression is a path; false for the times
  shape: "object" | "list" | "text" | "number" | "boolean" | "unknown";
  members: DataMember[]; // where the shape is known before the run, or from a sample
}
```

- **Order.** The steps before the field's step, nearest first, then the workflow's input, the variables, the secrets and the times.
- **The steps before** are the earlier steps of the step's list and of each list holding it; a fork's other branches run beside it and are not before it. A switch with no `output.as` passes its input on (it outputs its transformed input), so it is no entry of its own; one with an `output.as` passes on its result and is an entry like any step.
- **What flows in.** The step directly before reaches as `.` (dsl.md, "Data Flow", step 9) only when it is the step's only way in: it continues into it, it has no `if` (a skipped step passes on its own raw input), no `then` names the step, and, in the step's definition, the step has no `input.from` (step 4). In `if` and `input.from` the raw input flows in; in `output` and `export` the step's own output does, and no step before reaches as `.`.
- **Through the context.** Any other step before reaches only through `$context` (step 7): its entry reads `$context.<name>` and `needsExport` is true until the step writes the export that adds it, `export.as: ${ $context + { "<name>": . } }`. A step that writes another `export.as` is not offered, and neither is any step before a step that does, or before a block holding one (in any of its lists, a listen's or a subscription's `foreach` export included), since that export replaces the context. A block that holds the field's step counts the same way for the steps before it where its list runs again or after other steps of it: a loop (`for`, a `foreach`) whose list replaces the context hides them from the second item on, and so does a try whose tried steps replace it, for the steps that handle its failure. Step names are unique only within a list, so a step whose name another step already exports under is not offered, and `useData` refuses to export it, naming both steps. `$context` starts as the workflow's transformed input (the interpreter's initial context), so the exported keys share its names, and `$context + { … }` fails at run time where that input is not an object or `null`.
- **Shapes.** An `output.schema` gives a step's output (step 6). Else a `set` gives its values, with its input's members beside them where its `output.as` keeps the input (research D13); a script passes on the text it prints (`text`), its exit code (`number`), or, parsed by `output.as: ${ fromjson }`, JSON whose fields are not known before the run (`unknown`, research D14); everything else is `unknown`. The workflow's input is `$workflow.input`, its raw input (dsl.md, "Workflow Descriptor"), shaped by `input.schema`.
- **Scope.** The server writes `${ . }` into the field, analyses that copy of the document again and reads what the interpreter resolves there. This second analysis departs from one analysis per version (rubric A3, P19); a request costs 9.5 ms on a document of 62 steps, 27.6 ms on 201 and 45.8 ms on 401 (steps that each merge their input, measured on the reference machine), growing linearly with the steps and most of it that second analysis, and it ends once the interpreter answers the scope at a pointer from the model it already holds, which is asked of it. What the scope gives: the workflow's input needs `$workflow`, the steps through the context `$context`, the secrets `$secrets`, and the variables are the binders in scope (a `for`'s `each` and `at`, a catch's error).
- **References.** Every reference the client inserts comes from here: `expression` to put into an expression, `value` for a field that holds only it, and `isPath` where a field takes only a path (`.items`, `$context.fetch["a name"]`, `$secrets.token`); the times are computed, so they are no paths. A client builds no reference of its own.
- **Samples.** `samples` gives what each step put out in the last test run, as plain JSON keyed by step id. A step whose shape gives no members before the run takes its `shape` and `members` from its sample: each field of the sample's objects, at any depth, with its own expression (lists are not looked into). A step whose members are known before the run keeps them, whatever its sample holds.
- **Typed fields.** `typed`, where it is a field name (names of letters, digits, `_` and `-`, not starting with a digit or `-`, joined by `.`), gives each step entry whose shape is `object` or `unknown` the field it names in that step's output as `typed`: its `name` the typed text, its `expression` the path (`items.title` on `$context.fetch` is `$context.fetch.items.title`, `first-name` is `$context.fetch["first-name"]`), its `shape` `unknown`. It is `null` on the other entries, where no field name is typed, and where the step already offers that member. The test run shows whether the output has it.
- **Secrets** are offered only in fields where credentials go: under `authentication` or `headers`, or an address (`endpoint`, `uri`, `server`) (research D16). Each reads `$secrets.<name>`.
- **Times** are UTC times jq computes from the run's clock: `now` (`now | todate`), `today` and `yesterday` (the start of the day, `now | strftime("%Y-%m-%dT00:00:00Z")`, a day earlier for `yesterday`).
- **Warnings.** `inputNotKnownObject` on a set that keeps its input (`output.as: ${ $input + . }`) where that input is not known to be an object: jq adds an object only to an object or `null`. `mayHoldNothing` for a step offered through the context that has an `if`, or sits in a block that has one apart from the field's step: when it is skipped it exports nothing, and inside a loop the previous item's value stays. A step a jump passes over reads `null` too; no warning names it. `contextNotKnownObject` where data is read through the context and the workflow's transformed input is not known to be an object.
- **Broken text.** A text whose structure the grammar refuses answers from the steps of the last version that analysed.
- **Errors:** `ContentModified` (-32801); `RequestFailed` (-32803) for an unknown step id, a field outside the step, a text that does not read, and a document that has never analysed; `InvalidParams` (-32602), also for `samples` that are not an object and a `typed` that is not text.

**Example**, at the first condition of `route` in a document whose `greet` sets a message and whose `guard` then runs a try:

```json
{
  "textDocument": { "uri": "file:///flow.yaml", "version": 1 },
  "step": "/do/route",
  "field": "/do/2/route/switch/0/again/when",
  "samples": { "/do/guard": { "status": 200 } },
  "typed": "body.id"
}
```

```json
{
  "version": 1,
  "entries": [
    {
      "source": "step",
      "name": "guard",
      "step": "/do/guard",
      "expression": ".",
      "value": "${ . }",
      "isPath": true,
      "shape": "object",
      "needsExport": false,
      "members": [
        {
          "name": "status",
          "expression": ".status",
          "value": "${ .status }",
          "isPath": true,
          "shape": "number",
          "members": []
        }
      ],
      "typed": {
        "name": "body.id",
        "expression": ".body.id",
        "value": "${ .body.id }",
        "isPath": true,
        "shape": "unknown",
        "members": []
      }
    },
    {
      "source": "step",
      "name": "greet",
      "step": "/do/greet",
      "expression": "$context.greet",
      "value": "${ $context.greet }",
      "isPath": true,
      "shape": "object",
      "needsExport": true,
      "members": [
        {
          "name": "message",
          "expression": "$context.greet.message",
          "value": "${ $context.greet.message }",
          "isPath": true,
          "shape": "text",
          "members": []
        }
      ],
      "typed": {
        "name": "body.id",
        "expression": "$context.greet.body.id",
        "value": "${ $context.greet.body.id }",
        "isPath": true,
        "shape": "unknown",
        "members": []
      }
    },
    {
      "source": "workflowInput",
      "name": "input",
      "step": null,
      "expression": "$workflow.input",
      "value": "${ $workflow.input }",
      "isPath": true,
      "shape": "unknown",
      "needsExport": false,
      "members": [],
      "typed": null
    },
    {
      "source": "time",
      "name": "now",
      "step": null,
      "expression": "now | todate",
      "value": "${ now | todate }",
      "isPath": false,
      "shape": "text",
      "needsExport": false,
      "members": [],
      "typed": null
    }
  ],
  "warnings": [{ "kind": "contextNotKnownObject" }]
}
```

## Read a condition

**Method:** `workflow/readCondition`

The client sends this request to open a condition (a case's `when`, a step's `if`) in the condition builder. It names no document and holds no state: the text is the field's value, as the form gives it.

```typescript
interface ReadConditionParams {
  text: string;
}

type ReadConditionResult =
  | { kind: "condition"; condition: Condition }
  | { kind: "expression"; text: string }; // open the field as jq; the text as given

interface Condition {
  join: "all" | "any";
  rows: ConditionRow[]; // at least one to write; none for an empty text
}

type ConditionRow =
  | { left: string; comparison: "isEmpty" | "isNotEmpty"; right: null }
  | {
      left: string;
      comparison: "contains" | "doesNotContain";
      right: { kind: "value"; value: Literal };
    }
  | {
      left: string;
      comparison: "is" | "isNot" | "isGreaterThan" | "isLessThan";
      right: Operand;
    };

type Operand =
  | { kind: "data"; path: string } // a workflow/dataAt expression that is a path
  | { kind: "value"; value: Literal }
  | { kind: "time"; time: "now" | "today" | "yesterday" };

type Literal = string | number | boolean | null;
```

- **No condition yet.** An empty text, such as a new branch's `when: ""`, reads as a condition with no row, so the builder opens empty; writing it still needs a row.
- **One form.** A condition is written in one form, and read back only from exactly that form; any other text is `expression`, so the client opens it as jq and it is never rewritten. `left` and a `data` operand are paths: `.`, `.name`, `.["a name"]`, `$name` and their members.
- **Rows**, with `L` the left path and `R` the second value as jq (a literal as JSON, a time in brackets):

  | Comparison                    | jq                                                                                                                                                                                                            |
  | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `is`, `isNot`                 | `L == R`, `L != R`                                                                                                                                                                                            |
  | `contains`                    | `L \| if type == "array" then any(.[]; . == R) elif type == "string" then contains(T) else false end`, with `T` the value as a JSON string: an item of a list, or a part of a text; anything else is no match |
  | `doesNotContain`              | the same, then `\| not`                                                                                                                                                                                       |
  | `isEmpty`, `isNotEmpty`       | `L \| . == null or . == "" or . == [] or . == {}`, and its negation `L \| . != null and . != "" and . != [] and . != {}`: missing, `""`, `[]` and `{}` are empty, `0` and `false` are not                     |
  | `isGreaterThan`, `isLessThan` | `try ((L \| tonumber) > R) catch false` where `R` is a number, since jq orders every text after every number, a value that is no number being no match; else `L > R` (`<` alike)                              |

- **No faults.** A comparison of values never fails: a value of another kind is no match. Reading a path through a value that is not an object fails, as in any jq. Between two data paths, or data and a text, jq orders by kind first (`null`, `false`, `true`, numbers, texts, lists, objects), then by value; times written as ISO 8601 texts compare in time only when both are written in the same form (UTC, the same precision), as `now`, `today` and `yesterday` are.
- **Joins.** One row is written alone; several are each in brackets, joined by `and` (`all`) or `or` (`any`). The whole is a runtime expression, `${ … }`.
- **Writing** is `workflow/edit`'s `setCondition`. A condition with no row, or a path that is not one, is refused with its reason.
- **Errors:** `InvalidParams` (-32602), when the params hold no `text`.

**Example:**

```json
{
  "text": "${ (.status == \"paid\") and (.items | . != null and . != \"\" and . != [] and . != {}) }"
}
```

```json
{
  "kind": "condition",
  "condition": {
    "join": "all",
    "rows": [
      {
        "left": ".status",
        "comparison": "is",
        "right": { "kind": "value", "value": "paid" }
      },
      { "left": ".items", "comparison": "isNotEmpty", "right": null }
    ]
  }
}
```

## Edit

**Method:** `workflow/edit`

The client sends this request to turn a canvas or inspector action into text edits on a version. The edits keep the author's text: they replace only the ranges they must, a moved or duplicated step is the author's own text re-indented, and a new step is its variant's starting content.

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
      step: StepVariant; // workflow/stepVariants
      name: string | null;
    }
  | {
      kind: "insertStepOnBranch";
      switch: string; // the switch's step id
      case: string; // the branch: a case's name, as Transition.case
      step: StepVariant;
      name: string | null;
    }
  | { kind: "moveStep"; step: string; list: string; index: number }
  | { kind: "removeStep"; step: string }
  | { kind: "renameStep"; step: string; name: string }
  | { kind: "duplicateStep"; step: string }
  | { kind: "setField"; pointer: string; value: JsonValue }
  | { kind: "clearField"; pointer: string }
  | { kind: "setCondition"; pointer: string; condition: Condition }
  | { kind: "setFailure"; step: string; failure: Failure }
  | {
      kind: "wrapSteps";
      steps: string[]; // step ids next to each other in one list, in order
      block: "try" | "for" | "do";
      name: string | null; // the block's; the first step's when null
    }
  | { kind: "setResult"; step: string; result: ChosenResult }
  | {
      kind: "useData";
      pointer: string; // the field
      value: string; // what it holds, e.g. a workflow/dataAt entry's value
      export: string | null; // the step id to export first, where needsExport
    };

type Failure =
  | { kind: "stop" }
  | { kind: "continue" }
  | { kind: "retry"; retries: number; seconds: number; growing: boolean }
  | { kind: "handle" };

interface EditResult {
  edits: TextEdit[];
  ids: { from: string; to: string }[];
}
```

- **Ids** are the structure's. `index` is the step's index in the target list after the action. `ids` lists every id the action changes: `renameStep`, and `moveStep` into another list, give the step and every step and list below it; the others give none.
- **Names.** A new step without a name takes its kind's name, whatever its variant (`call` for an HTTP or MCP call, `run` for a script or a shell), then `<kind>-2`, `-3`, …; a duplicate takes the next free `<name>-2`.
- **Starting content.** A new step is its variant's starting content (`workflow/stepVariants`).
- **A catch's first step.** `insertStep` into `<id>/catch/do`, `<id>` being the try's id, where the try's catch writes no `do`, writes that list with the new step and keeps the rest of the catch, its `retry` included, so the step's `catch.afterward` becomes `handle`. The list has no steps yet, so any index other than 0 is refused.
- **Fields.** `setField` and `clearField` act at any member of a step or of the document, such as `/schedule/cron`. `setField` also writes the holders the text lacks, as an author would: a member added to a block mapping is written in block style, so `setField` at `/input/schema` on a workflow with no `input` writes `input:`, then `schema:` and the value below it; one added to a flow mapping stays on its line.
- **Text with line breaks.** A string with a line break, set in a block mapping or sequence, is written as a literal block scalar indented under its key or dash: `|` when it ends in one line break, `|-` when it ends in none, `|+` when it ends in more, the indentation indicator where its first line starts with a space; a comment after the old value moves to the block's header, and a block's header comment stays beside a value that becomes one line. Where a block would take in what follows it (an empty line after a value that ends in several line breaks, or a comment indented under the key) the value is written double-quoted instead; an old block that keeps its final line breaks (`|+`) is replaced with them. A one-line string keeps the style it was written in, a block scalar's included (`code: |-` and the line). In a flow collection a string stays on its line, double-quoted where it holds a line break.
- **A step on a branch** (`insertStepOnBranch`). The new step goes directly after the switch, in the switch's list, because flow directives name only tasks of their own list (dsl.md, "Task Flow") and the only step that can run into that place is the switch itself. Where the branch led stays where it leads, through the new step:

  | The branch's `then` | Its `then` after                  | The new step's `then`                                                               |
  | ------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
  | `continue`          | `continue`, now into the new step | none: it continues to the step that followed the switch, or off the end of the list |
  | a step's name       | the new step's name               | that step's name                                                                    |
  | `end`               | the new step's name               | `end`                                                                               |
  | `exit`              | the new step's name               | `exit`                                                                              |

  Every other way out of the switch that continued now runs into the new step, so it is written out: each other case whose `then` is `continue`, and the switch's own `then` when it continues and no case is the default (a switch with no matching case follows its own `then`). Each names the step that followed the switch; where the switch was its list's last step, `end` in the workflow's own list and `exit` in a nested one, which complete the run and the block as running off their end does. A switch that is a branch of a fork is refused: a step after it would be another branch. `ids` is empty, as for `insertStep`.

- **Wrap in a block** (`wrapSteps`). The steps, with their text, become the list of a new block in their place: a try that starts with the retry of the `try` variant, a for whose list is left to fill (`in: ""`, an `expression` problem), or a do. The block takes the given name, else its first step's, so every `then` that named that step still lands on the block; with a name of its own, those `then`s name the block. Flow directives keep their meaning (dsl.md, "Task Flow": a directive names only tasks of its own list, `exit` completes its list, `end` the workflow):

  | Directive                                                      | Kept                                          | Rewritten                                                          | Refused                                               |
  | -------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
  | in a wrapped step: `continue`, `end`, or a wrapped step's name | yes                                           |                                                                    |                                                       |
  | in a wrapped step: the name of the step right after the steps  |                                               | `exit`, in a try or a do, whose list then completes into that step | in a for, where `exit` would end only one item's turn |
  | in a wrapped step: any other step's name                       |                                               |                                                                    | yes: no step inside a block can go outside it         |
  | in a wrapped step: `exit`                                      |                                               | `end`, in the workflow's own list, where both complete the run     | in a nested list, where it would leave only the block |
  | elsewhere in the list: the first wrapped step's name           | yes, or the block's name where it has its own |                                                                    |                                                       |
  | elsewhere in the list: another wrapped step's name             |                                               |                                                                    | yes: only a block's first step can be gone to         |

  Several branches of a fork are refused, since they run at once. `ids` maps each wrapped step, and everything below it, into the block's list (`/do/fetch` to `/do/fetch/do/fetch`).

- **If it fails** (`setFailure`: `stop`, `continue`, `retry` or `handle`), on a step's id:
  - on a step no try protects, `continue`, `retry` and `handle` wrap the author's step text, re-indented, in a try of the same name, and move the step's `then` to the try; `stop` changes nothing;
  - on a protecting try (a try whose `try` list holds one step), `continue`, `retry` and `handle` replace its `catch`, and `stop` gives the step its own text back in the try's place, with the try's `then`;
  - the `catch` written: `continue` `{}`; `retry` `{ retry: { delay: { seconds }, backoff: { constant: {} } or { exponential: {} } when growing, limit: { attempt: { count: retries } } } }`, the language counting retries in `count`; `handle` `{ do: [] }`, an empty list the web fills with `insertStep` into `<id>/catch/do`; a `handle` on a try whose catch already writes `do` changes nothing;
  - `ids`: wrapping moves the step and everything below it under `<id>/try` (`/do/greet` to `/do/greet/try/greet`); unwrapping moves them back; the try keeps the step's former id.
- **The step's result** (`setResult`) writes the members of the chosen result and removes the others: `output.as`, and the `output` that holds nothing else; a script's `run.return`, set to the mode the result needs (`stdout` or `code`) where the step returns another. A result the step does not offer is refused.
- **Conditions** (`setCondition`) write the condition at the field in its one form (`workflow/readCondition`), as `setField` would its text.
- **Data** (`useData`) sets the field to the value and, with `export`, writes that step's `export.as: ${ $context + { "<name>": . } }`, the export a `$context.<name>` entry of `workflow/dataAt` reads; a step that already writes it is left as it is, and a step that writes another export is refused.
- **Errors:**
  - `ContentModified` (-32801), when the version is not the store's;
  - `RequestFailed` (-32803), with its reason, for a step action or `setFailure` on a version that does not analyse, a field action on a text that does not read, an unknown step or list id, an index outside the list, a step on a branch of a step that is not a switch, of a branch the switch does not have, or of a switch that is a fork's branch, a condition with no row or with a path that is not one, a wrap of no step, of steps not next to each other in one list, of several fork branches or whose directives cannot keep their meaning, a result the step does not offer, data whose export names a step that writes its own export, a move into the step's own lists, an empty name, a flow directive as a name, a name a sibling has, a field below a value that holds no object, and a field to clear that is not written;
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
