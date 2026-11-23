import type {
  FormField,
  RetryPlan,
  Step,
  StepFormResult,
  WorkflowFormResult,
} from "language-server/protocol";
import type { Json, JsonObject } from "./json";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";

type FieldShape = Partial<FormField> & Pick<FormField, "key" | "pointer">;

const EMPTY_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 0 },
};

export function fieldOf(shape: FieldShape): FormField {
  return {
    title: shape.key,
    section: "settings",
    description: null,
    input: "text",
    choices: [],
    required: false,
    written: false,
    value: null,
    essentialRank: null,
    fields: [],
    diagnostics: [],
    ...shape,
  };
}

export function problemOf(message: string): Diagnostic {
  const severity = DiagnosticSeverity.Error;
  return { range: EMPTY_RANGE, severity, message, source: "workflow" };
}

function commonFields(pointer: string, names: readonly string[]) {
  const flowChoices = ["continue", "exit", "end", ...names];
  return [
    fieldOf({ key: "if", title: "Run only if", pointer: `${pointer}/if` }),
    fieldOf({
      key: "input",
      title: "Input",
      pointer: `${pointer}/input`,
      section: "data",
      input: "group",
      fields: [
        fieldOf({
          key: "from",
          title: "From",
          pointer: `${pointer}/input/from`,
          section: "data",
        }),
      ],
    }),
    fieldOf({
      key: "output",
      title: "Output",
      pointer: `${pointer}/output`,
      section: "data",
      input: "group",
      fields: [
        fieldOf({
          key: "as",
          title: "As",
          pointer: `${pointer}/output/as`,
          section: "data",
        }),
      ],
    }),
    fieldOf({
      key: "timeout",
      title: "Time limit",
      pointer: `${pointer}/timeout`,
      section: "failure",
    }),
    fieldOf({
      key: "then",
      title: "Then go to",
      pointer: `${pointer}/then`,
      choices: flowChoices,
    }),
    fieldOf({
      key: "metadata",
      title: "Notes",
      pointer: `${pointer}/metadata`,
      section: "note",
      input: "structured",
    }),
  ];
}

const NAMES = ["Fetch the digest", "Has items", "Post the items", "Totals"];

export function stepOf(name: string, index: number, kind: Step["kind"]): Step {
  return {
    id: `/do/${name}`,
    pointer: `/do/${String(index)}/${name}`,
    name,
    kind,
    variant: null,
    family: "call",
    summary: null,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists: [],
    flow: [],
    catch: null,
  };
}

export const FETCH_STEP = stepOf("Fetch the digest", 0, "call");

export const SWITCH_STEP = stepOf("Has items", 1, "switch");

export const POST_STEP = stepOf("Post the items", 2, "call");

export const SET_STEP = stepOf("Totals", 3, "set");

export const SCRIPT_STEP = stepOf("Shape people", 4, "run");

export const WAIT_STEP = stepOf("Pause", 5, "wait");

export const REPORT_STEP = stepOf("Send report", 6, "try");

export const REPORT_INNER_STEP: Step = {
  ...stepOf("Send report", 0, "call"),
  id: `${REPORT_STEP.id}/try/Send report`,
  pointer: `${REPORT_STEP.pointer}/try/0/Send report`,
};

function httpFields(
  pointer: string,
  method: string,
  endpoint: string,
  problems: readonly string[],
): FormField[] {
  const diagnostics = problems.map(problemOf);
  const sends = method !== "get";
  return [
    ...commonFields(pointer, NAMES),
    fieldOf({
      key: "call",
      title: "Kind of call",
      pointer: `${pointer}/call`,
      input: "choice",
      choices: ["http"],
      required: true,
      written: true,
      value: "http",
    }),
    fieldOf({
      key: "with",
      title: "Arguments",
      pointer: `${pointer}/with`,
      input: "group",
      required: true,
      written: true,
      value: { method, endpoint },
      diagnostics,
      fields: [
        fieldOf({
          key: "method",
          title: "Method",
          pointer: `${pointer}/with/method`,
          required: true,
          written: true,
          value: method,
          essentialRank: 0,
        }),
        fieldOf({
          key: "endpoint",
          title: "Endpoint",
          pointer: `${pointer}/with/endpoint`,
          required: true,
          written: true,
          value: endpoint,
          essentialRank: 1,
          diagnostics,
        }),
        fieldOf({
          key: "headers",
          title: "Headers",
          pointer: `${pointer}/with/headers`,
        }),
        fieldOf({
          key: "body",
          title: "Body",
          pointer: `${pointer}/with/body`,
          essentialRank: sends ? 2 : null,
        }),
        fieldOf({
          key: "output",
          title: "Output",
          pointer: `${pointer}/with/output`,
          input: "choice",
          choices: ["raw", "content", "response"],
        }),
        fieldOf({
          key: "redirect",
          title: "Redirect",
          pointer: `${pointer}/with/redirect`,
          input: "boolean",
        }),
      ],
    }),
  ];
}

export const FETCH_FORM: StepFormResult = {
  version: 1,
  step: FETCH_STEP.id,
  failure: "stop",
  retry: null,
  result: null,
  fields: httpFields(FETCH_STEP.pointer, "get", "https://httpbin.org/json", []),
};

export const POST_FORM: StepFormResult = {
  version: 1,
  step: POST_STEP.id,
  failure: "stop",
  retry: null,
  result: null,
  fields: httpFields(POST_STEP.pointer, "post", "", [
    "Endpoint is not in the form the standard requires.",
  ]),
};

export const REPORT_FORM: StepFormResult = {
  version: 1,
  step: REPORT_INNER_STEP.id,
  failure: "stop",
  retry: null,
  result: null,
  fields: httpFields(
    REPORT_INNER_STEP.pointer,
    "post",
    "https://hooks.example.com/report",
    [],
  ),
};

export const RETRY_PLAN: RetryPlan = {
  retries: 3,
  milliseconds: 2000,
  backoff: "exponential",
  when: null,
  exceptWhen: null,
  on: { kind: "any" },
};

export function protectionOf(
  catchValue: JsonObject,
  failure: StepFormResult["failure"],
  plan: RetryPlan | null = null,
): StepFormResult {
  const pointer = REPORT_STEP.pointer;
  const retry = catchValue.retry;
  const handled = catchValue.do;
  return {
    version: 1,
    step: REPORT_STEP.id,
    failure,
    retry: plan,
    result: null,
    fields: [
      ...commonFields(pointer, NAMES),
      fieldOf({
        key: "try",
        title: "Try",
        pointer: `${pointer}/try`,
        input: "structured",
        required: true,
        written: true,
        value: [],
      }),
      fieldOf({
        key: "catch",
        title: "When it fails",
        pointer: `${pointer}/catch`,
        section: "failure",
        input: "group",
        required: true,
        written: true,
        value: catchValue,
        fields: [
          fieldOf({
            key: "retry",
            title: "Retry",
            pointer: `${pointer}/catch/retry`,
            section: "failure",
            input: "structured",
            written: retry !== undefined,
            value: retry ?? null,
            essentialRank: 0,
          }),
          fieldOf({
            key: "do",
            title: "Do",
            pointer: `${pointer}/catch/do`,
            section: "failure",
            input: "structured",
            written: handled !== undefined,
            value: handled ?? null,
            essentialRank: 1,
          }),
        ],
      }),
    ],
  };
}

export const RETRY_POLICY: JsonObject = {
  delay: { seconds: 2 },
  backoff: { exponential: {} },
  limit: { attempt: { count: 3 } },
};

export const RETRYING = protectionOf(
  { retry: RETRY_POLICY },
  "retry",
  RETRY_PLAN,
);

export const CONTINUING = protectionOf({}, "continue");

export const HANDLING = protectionOf({ do: [] }, "handle");

export const RETRYING_THEN_HANDLING = protectionOf(
  { retry: RETRY_POLICY, do: [] },
  "handle",
  RETRY_PLAN,
);

export const SWITCH_CASES: Json = [
  {
    "Has items": {
      when: '${ .slideshow.slides | . != null and . != "" and . != [] and . != {} }',
      then: "continue",
    },
  },
  { default: { then: "end" } },
];

export const SWITCH_FORM: StepFormResult = {
  version: 1,
  step: SWITCH_STEP.id,
  failure: "stop",
  retry: null,
  result: null,
  fields: [
    ...commonFields(SWITCH_STEP.pointer, NAMES),
    fieldOf({
      key: "switch",
      title: "Switch",
      pointer: `${SWITCH_STEP.pointer}/switch`,
      input: "structured",
      required: true,
      written: true,
      value: SWITCH_CASES,
      essentialRank: 0,
    }),
  ],
};

export function setFormOf(
  values: Record<string, string>,
  result: "inputAndValues" | "valuesOnly" | "written",
): StepFormResult {
  return {
    version: 1,
    step: SET_STEP.id,
    failure: "stop",
    retry: null,
    result: { value: result, choices: ["inputAndValues", "valuesOnly"] },
    fields: [
      ...commonFields(SET_STEP.pointer, NAMES),
      fieldOf({
        key: "set",
        title: "Set",
        pointer: `${SET_STEP.pointer}/set`,
        input: "structured",
        required: true,
        written: true,
        value: values,
        essentialRank: 0,
      }),
    ],
  };
}

export const SET_FORM = setFormOf(
  { total: "${ [.slideshow.slides[]] | length }" },
  "inputAndValues",
);

const SCRIPT = `${SCRIPT_STEP.pointer}/run/script`;

export const SCRIPT_FORM: StepFormResult = {
  version: 1,
  step: SCRIPT_STEP.id,
  failure: "stop",
  retry: null,
  result: {
    value: "printedJson",
    choices: ["printedJson", "printedText", "exitCode"],
  },
  fields: [
    ...commonFields(SCRIPT_STEP.pointer, NAMES),
    fieldOf({
      key: "run",
      title: "Run",
      pointer: `${SCRIPT_STEP.pointer}/run`,
      input: "group",
      required: true,
      written: true,
      value: { script: { language: "js", code: "console.log(1)\n" } },
      fields: [
        fieldOf({
          key: "await",
          title: "Await",
          pointer: `${SCRIPT_STEP.pointer}/run/await`,
          input: "boolean",
        }),
        fieldOf({
          key: "return",
          title: "Return",
          pointer: `${SCRIPT_STEP.pointer}/run/return`,
          input: "choice",
          choices: ["stdout", "stderr", "code", "all", "none"],
        }),
        fieldOf({
          key: "container",
          title: "Container",
          pointer: `${SCRIPT_STEP.pointer}/run/container`,
          input: "structured",
        }),
        fieldOf({
          key: "script",
          title: "Script",
          pointer: SCRIPT,
          input: "group",
          written: true,
          value: { language: "js", code: "console.log(1)\n" },
          fields: [
            fieldOf({
              key: "language",
              title: "Language",
              pointer: `${SCRIPT}/language`,
              required: true,
              written: true,
              value: "js",
              essentialRank: 0,
            }),
            fieldOf({
              key: "arguments",
              title: "Arguments",
              pointer: `${SCRIPT}/arguments`,
              input: "structured",
              essentialRank: 2,
            }),
            fieldOf({
              key: "environment",
              title: "Environment",
              pointer: `${SCRIPT}/environment`,
              input: "structured",
            }),
            fieldOf({
              key: "code",
              title: "Code",
              pointer: `${SCRIPT}/code`,
              written: true,
              value: "console.log(JSON.stringify({ people: [] }))\n",
              essentialRank: 1,
            }),
            fieldOf({
              key: "source",
              title: "Source",
              pointer: `${SCRIPT}/source`,
              input: "structured",
            }),
          ],
        }),
      ],
    }),
  ],
};

const UNITS = ["days", "hours", "minutes", "seconds", "milliseconds"];

function unitsOf(pointer: string, amounts: Readonly<Record<string, number>>) {
  return UNITS.map((unit) =>
    fieldOf({
      key: unit,
      title: unit.charAt(0).toUpperCase() + unit.slice(1),
      pointer: `${pointer}/${unit}`,
      input: "number",
      value: amounts[unit] ?? null,
    }),
  );
}

export const WAIT_FORM: StepFormResult = {
  version: 1,
  step: WAIT_STEP.id,
  failure: "stop",
  retry: null,
  result: null,
  fields: [
    ...commonFields(WAIT_STEP.pointer, NAMES),
    fieldOf({
      key: "wait",
      title: "Wait",
      pointer: `${WAIT_STEP.pointer}/wait`,
      input: "duration",
      required: true,
      written: true,
      value: "PT30M",
      essentialRank: 0,
      fields: unitsOf(`${WAIT_STEP.pointer}/wait`, { minutes: 30 }),
    }),
  ],
};

export function workflowFormOf(
  schedule: JsonObject | null,
): WorkflowFormResult {
  const written = schedule ?? {};
  const cron = written.cron;
  const on = written.on;
  const every = written.every;
  return {
    version: 1,
    fields: [
      fieldOf({
        key: "title",
        title: "Title",
        pointer: "/document/title",
        section: "note",
        written: true,
        value: "Daily digest",
        essentialRank: 0,
      }),
      fieldOf({
        key: "schedule",
        title: "How it starts",
        pointer: "/schedule",
        input: "group",
        written: schedule !== null,
        value: schedule,
        essentialRank: 1,
        fields: [
          fieldOf({
            key: "every",
            title: "Every",
            pointer: "/schedule/every",
            input: "duration",
            written: every !== undefined,
            value: every ?? null,
            fields: unitsOf("/schedule/every", {}),
          }),
          fieldOf({
            key: "cron",
            title: "On a cron schedule",
            pointer: "/schedule/cron",
            written: typeof cron === "string",
            value: typeof cron === "string" ? cron : null,
          }),
          fieldOf({
            key: "on",
            title: "On events",
            pointer: "/schedule/on",
            input: "group",
            written: on !== undefined,
            value: on ?? null,
          }),
        ],
      }),
      fieldOf({
        key: "input",
        title: "Input",
        pointer: "/input",
        section: "data",
        input: "group",
        fields: [
          fieldOf({
            key: "schema",
            title: "Schema",
            pointer: "/input/schema",
            section: "data",
            input: "structured",
          }),
        ],
      }),
    ],
  };
}

export const SCHEDULED = workflowFormOf({ cron: "0 9 * * *" });

export const BY_HAND = workflowFormOf(null);

export const ON_SIGN_UP = workflowFormOf({
  on: { one: { with: { type: "com.example.signup.v1" } } },
});

export function formWith(
  form: StepFormResult,
  key: string,
  value: Json,
): StepFormResult {
  const fields = form.fields.map((field) =>
    field.key === key ? { ...field, value } : field,
  );
  return { ...form, fields };
}

export function formChanged(
  form: StepFormResult,
  pointer: string,
  change: Partial<FormField>,
): StepFormResult {
  const fields = form.fields.map((field) =>
    fieldChanged(field, pointer, change),
  );
  return { ...form, fields };
}

function fieldChanged(
  field: FormField,
  pointer: string,
  change: Partial<FormField>,
): FormField {
  if (field.pointer === pointer) return { ...field, ...change };

  const fields = field.fields.map((inner) =>
    fieldChanged(inner, pointer, change),
  );
  return { ...field, fields };
}
