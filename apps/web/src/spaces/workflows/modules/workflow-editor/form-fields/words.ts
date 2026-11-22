import type { ChosenResult, FormField } from "language-server/protocol";
import type {
  FieldWords,
  FlowChoice,
  WordsEntry,
  WordsKind,
} from "./interfaces";

const ANY_KIND = "*";

const NO_CHOICES: ReadonlyMap<string, string> = new Map();

const FLOW_WORDS: ReadonlyMap<string, string> = new Map([
  ["continue", "Continue with the next step"],
  ["exit", "Leave the block"],
  ["end", "End the run"],
]);

const HTTP_RESULTS: ReadonlyMap<string, string> = new Map([
  ["content", "The response's content (usual)"],
  ["response", "The whole response (status, headers, content)"],
  ["raw", "The response as it came, undecoded"],
]);

const RESULT_WORDS: ReadonlyMap<ChosenResult, string> = new Map([
  ["printedJson", "The JSON it prints (usual)"],
  ["printedText", "The text it prints"],
  ["exitCode", "Its exit code"],
  ["inputAndValues", "The data that came in, with these values beside it"],
  ["valuesOnly", "Only these values"],
]);

const ADDRESS_FILL =
  "Enter the address to call, for example https://api.example.com/orders";

const WORDS: ReadonlyMap<string, WordsEntry> = new Map([
  [
    "*|if",
    {
      title: "Run only if",
      help: "Skip the step unless the condition holds.",
      control: "condition",
    },
  ],
  ["*|then", { title: "After this step", control: "flow" }],
  ["*|timeout", { title: "Time limit" }],
  ["*|metadata", { title: "Notes" }],
  [
    "*|input/from",
    {
      title: "Input from",
      mono: true,
      help: "A jq expression that shapes what the step receives.",
    },
  ],
  ["*|output/as", { title: "Output as", mono: true }],
  ["*|export/as", { title: "Export as", mono: true }],
  ["http|with/method", { title: "What it does", control: "httpMethod" }],
  [
    "http|with/endpoint",
    {
      title: "Address",
      placeholder: "https://",
      fill: ADDRESS_FILL,
      control: "data",
    },
  ],
  [
    "http|with/body",
    {
      title: "Data",
      help: "Insert data from an earlier step, or type JSON.",
      control: "data",
    },
  ],
  ["http|with/headers", { title: "Headers", control: "data" }],
  ["http|with/query", { title: "Query", control: "data" }],
  ["http|with/output", { title: "The step's result", choices: HTTP_RESULTS }],
  ["http|with/redirect", { title: "Follow redirects" }],
  [
    "openapi|with/document/endpoint",
    {
      title: "API description",
      placeholder: "https://api.example.com/openapi.yaml",
      fill: "Enter the address of the API description",
      control: "data",
    },
  ],
  ["openapi|with/operationId", { title: "Operation", mono: true }],
  [
    "mcp|with/transport/http/endpoint",
    {
      title: "MCP server",
      placeholder: "https://mcp.example.com",
      control: "data",
    },
  ],
  ["a2a|with/server", { title: "Agent's address", control: "data" }],
  ["script|run/script/language", { title: "Language", control: "language" }],
  [
    "script|run/script/code",
    {
      title: "Code",
      help: "Print the result as JSON.",
      fill: "Write the code the step runs.",
      control: "code",
    },
  ],
  [
    "script|run/script/arguments",
    { title: "Data the script gets", control: "values" },
  ],
  [
    "script|run/script/environment",
    { title: "Environment variables", control: "values" },
  ],
  ["script|run/await", { title: "Wait for it to finish" }],
  ["script|run/return", { control: "hidden" }],
  [
    "shell|run/shell/command",
    {
      title: "Command",
      mono: true,
      placeholder: "date -u",
      fill: "Write the command the step runs.",
    },
  ],
  ["container|run/container/image", { title: "Image", mono: true }],
  ["container|run/container/command", { title: "Command", mono: true }],
  ["workflow|run/workflow/name", { title: "Workflow", mono: true }],
  ["workflow|run/workflow/input", { title: "Input", control: "data" }],
  [
    "emit|emit/event/with/type",
    {
      title: "Event type",
      mono: true,
      placeholder: "com.example.order.placed.v1",
    },
  ],
  ["emit|emit/event/with/data", { title: "Data", control: "data" }],
  [
    "for|for/in",
    {
      title: "For each item in",
      help: "Steps inside the block run once per item.",
      control: "data",
    },
  ],
  ["for|for/each", { title: "Call each item", mono: true }],
  [
    "raise|raise/error/title",
    { title: "Error title", fill: "Give the error a title." },
  ],
  ["raise|raise/error/type", { title: "Kind of error", mono: true }],
  ["set|set", { title: "Values", control: "values" }],
  [
    "switch|switch",
    {
      title: "Branches",
      help: "The first branch whose conditions hold is taken; order matters.",
      control: "cases",
    },
  ],
  ["wait|wait", { title: "Wait for" }],
  [
    "start|input/schema",
    {
      title: "What the workflow expects",
      help: "Fields described here become the form of the Run dialog.",
    },
  ],
  ["start|input/from", { title: "Input from", mono: true }],
]);

export function wordsOf(
  kind: WordsKind,
  path: string,
  field: FormField,
): FieldWords {
  const own = WORDS.get(`${kind}|${path}`);
  const shared = WORDS.get(`${ANY_KIND}|${path}`);
  const entry = own ?? shared ?? {};
  return {
    title: entry.title ?? field.title,
    help: entry.help ?? null,
    placeholder: entry.placeholder ?? "",
    fill: entry.fill ?? null,
    control: entry.control ?? "value",
    mono: entry.mono ?? false,
    choices: entry.choices ?? NO_CHOICES,
  };
}

export function hasWords(kind: WordsKind, path: string): boolean {
  return WORDS.has(`${kind}|${path}`) || WORDS.has(`${ANY_KIND}|${path}`);
}

export function flowChoicesOf(
  choices: readonly FormField["value"][],
): FlowChoice[] {
  const texts = choices.filter((choice) => typeof choice === "string");
  return texts.map((value) => {
    const text = flowText(value);
    return { value, text };
  });
}

export function flowText(value: string): string {
  return FLOW_WORDS.get(value) ?? `Go to “${value}”`;
}

export function resultText(result: ChosenResult): string {
  return RESULT_WORDS.get(result) ?? result;
}
