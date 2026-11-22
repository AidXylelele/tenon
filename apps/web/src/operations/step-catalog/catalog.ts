import type { StepVariant } from "language-server/protocol";
import type {
  CatalogEntry,
  CatalogGroup,
  EntryAction,
  EntryWords,
} from "./interfaces";

export const HTTP_ENTRY: CatalogEntry = {
  id: "http",
  title: "Fetch or send to a URL",
  description:
    "Get data from a web address, or send data to it — also how you post to Slack, Teams or email services",
  example: "GET https://api.example.com/orders",
  synonyms: [
    "http",
    "url",
    "api",
    "rest",
    "request",
    "get",
    "post",
    "fetch",
    "download",
    "webhook",
    "call",
    "slack",
    "teams",
    "discord",
    "chat",
    "email",
    "notify",
    "message",
    "send",
  ],
  languageTerm: "call: http",
  icon: "globe",
  action: { kind: "insertStep", variant: "http" },
};

const CATALOG: readonly CatalogGroup[] = [
  {
    id: "common",
    title: "Common",
    entries: [
      HTTP_ENTRY,
      {
        id: "switch",
        title: "Choose a path",
        description:
          "Go one way or another by a condition; also “only continue if”",
        example: "If the answer has items → post them",
        synonyms: [
          "if",
          "else",
          "condition",
          "branch",
          "when",
          "route",
          "switch",
          "filter",
          "only continue",
        ],
        languageTerm: "switch",
        icon: "split",
        action: { kind: "insertStep", variant: "switch" },
      },
      {
        id: "for",
        title: "Repeat for each item",
        description: "Run steps for every item of a list",
        example: "For each invoice in the invoices",
        synonyms: ["loop", "each", "iterate", "map", "foreach", "list", "for"],
        languageTerm: "for",
        icon: "repeat",
        action: { kind: "insertStep", variant: "for" },
      },
      {
        id: "set",
        title: "Set data",
        description: "Add named values for later steps",
        example: "total = order amount × 1.2",
        synonyms: [
          "set",
          "assign",
          "variable",
          "map",
          "compute",
          "add",
          "value",
        ],
        languageTerm: "set",
        icon: "braces",
        action: { kind: "insertStep", variant: "set" },
      },
      {
        id: "wait",
        title: "Wait",
        description: "Pause for a while",
        example: "30 minutes",
        synonyms: ["delay", "sleep", "pause", "timer", "wait"],
        languageTerm: "wait",
        icon: "timer",
        action: { kind: "insertStep", variant: "wait" },
      },
      {
        id: "script-js",
        title: "Run JavaScript",
        description: "Transform data with a short script",
        example: "people.map((p) => p.name)",
        synonyms: ["js", "javascript", "node", "code", "script", "transform"],
        languageTerm: "run: script · js",
        icon: "file-code",
        action: { kind: "insertStep", variant: "script-js" },
      },
      {
        id: "retry",
        title: "Retry a step if it fails",
        description: "Try the step before this one again when it fails",
        example: "3 times, 2 s apart, growing",
        synonyms: ["retry", "again", "on failure", "error", "fallback"],
        languageTerm: "try · catch.retry",
        icon: "rotate-cw",
        action: {
          kind: "setFailure",
          failure: { kind: "retry", retries: 3, seconds: 2, growing: true },
        },
      },
      {
        id: "start",
        title: "Change how the workflow starts",
        description: "By hand, on a schedule, by a webhook or an event",
        example: "Every day at 09:00 UTC",
        synonyms: [
          "schedule",
          "trigger",
          "cron",
          "every",
          "daily",
          "hourly",
          "webhook",
          "start",
          "when",
        ],
        languageTerm: "schedule",
        icon: "calendar-clock",
        action: { kind: "changeStart" },
      },
    ],
  },
  {
    id: "decide",
    title: "Decide and repeat",
    entries: [
      {
        id: "fork",
        title: "Run branches at once",
        description: "Run several branches side by side",
        example: "Check Europe and America together",
        synonyms: ["parallel", "concurrent", "at the same time", "fork"],
        languageTerm: "fork",
        icon: "git-fork",
        action: { kind: "insertStep", variant: "fork" },
      },
      {
        id: "do",
        title: "Group steps",
        description: "Keep steps together as one block",
        example: "Prepare the batch",
        synonyms: ["block", "sequence", "group", "do"],
        languageTerm: "do",
        icon: "square-stack",
        action: { kind: "insertStep", variant: "do" },
      },
      {
        id: "try",
        title: "Try and handle failure",
        description: "Retry steps, or run others when they fail",
        example: "Retry 3 times, then run other steps",
        synonyms: ["retry", "catch", "error", "fallback", "on failure", "try"],
        languageTerm: "try",
        icon: "shield",
        action: { kind: "insertStep", variant: "try" },
      },
    ],
  },
  {
    id: "code",
    title: "Run code",
    entries: [
      {
        id: "script-python",
        title: "Run Python",
        description: "Transform data with a short script",
        example: 'sum(o["total"] for o in orders)',
        synonyms: ["python", "py", "code", "script"],
        languageTerm: "run: script · python",
        icon: "file-code",
        action: { kind: "insertStep", variant: "script-python" },
      },
      {
        id: "shell",
        title: "Run a shell command",
        description: "Run a command on the platform's shell",
        example: "date -u",
        synonyms: ["shell", "bash", "sh", "command", "cli", "terminal"],
        languageTerm: "run: shell",
        icon: "terminal",
        action: { kind: "insertStep", variant: "shell" },
      },
      {
        id: "container",
        title: "Run a container",
        description: "Run an image and use its output",
        example: "alpine:3.20",
        synonyms: ["docker", "container", "image"],
        languageTerm: "run: container",
        icon: "container",
        action: { kind: "insertStep", variant: "container" },
      },
      {
        id: "workflow",
        title: "Run another workflow",
        description: "Start a workflow and use its result",
        example: "Accept a lead only with an email",
        synonyms: ["subflow", "call workflow", "child", "reuse"],
        languageTerm: "run: workflow",
        icon: "workflow",
        action: { kind: "insertStep", variant: "workflow" },
      },
    ],
  },
  {
    id: "events",
    title: "Wait and events",
    entries: [
      {
        id: "listen",
        title: "Wait for events",
        description: "Pause until an event arrives, with a time limit",
        example: "until order.approved arrives, at most 3 days",
        synonyms: ["listen", "approval", "receive", "webhook", "callback"],
        languageTerm: "listen",
        icon: "inbox",
        action: { kind: "insertStep", variant: "listen" },
      },
      {
        id: "emit",
        title: "Emit an event",
        description: "Send an event to Tenon and to apps that listen",
        example: "order.placed",
        synonyms: ["publish", "send event", "cloudevent", "emit"],
        languageTerm: "emit",
        icon: "send",
        action: { kind: "insertStep", variant: "emit" },
      },
      {
        id: "raise",
        title: "Stop with an error",
        description: "End the run with an error you describe",
        example: "The lead has no email",
        synonyms: ["raise", "throw", "fail", "error", "abort", "stop"],
        languageTerm: "raise",
        icon: "octagon-x",
        action: { kind: "insertStep", variant: "raise" },
      },
    ],
  },
  {
    id: "developers",
    title: "For developers",
    entries: [
      {
        id: "openapi",
        title: "Call an OpenAPI operation",
        description: "Pick an operation from an API's OpenAPI description",
        example: "createInvoice in billing.yaml",
        synonyms: ["swagger", "rest", "api", "operation", "openapi"],
        languageTerm: "call: openapi",
        icon: "book-open",
        action: { kind: "insertStep", variant: "openapi" },
      },
      {
        id: "mcp",
        title: "Call an MCP tool",
        description: "Use a tool of an MCP server",
        example: "search on mcp.example.com",
        synonyms: [
          "ai",
          "agent",
          "tool",
          "model context protocol",
          "llm",
          "mcp",
        ],
        languageTerm: "call: mcp",
        icon: "wrench",
        action: { kind: "insertStep", variant: "mcp" },
      },
      {
        id: "grpc",
        title: "Call a gRPC method",
        description: "Call a method described by a proto file",
        example: "orders.v1.Orders/Get",
        synonyms: ["grpc", "protobuf", "rpc"],
        languageTerm: "call: grpc",
        icon: "plug",
        action: { kind: "insertStep", variant: "grpc" },
      },
      {
        id: "asyncapi",
        title: "Publish or read a message (AsyncAPI)",
        description: "Kafka, MQTT, AMQP, NATS and more",
        example: "orders channel on kafka",
        synonyms: [
          "kafka",
          "mqtt",
          "amqp",
          "nats",
          "message",
          "queue",
          "asyncapi",
        ],
        languageTerm: "call: asyncapi",
        icon: "radio-tower",
        action: { kind: "insertStep", variant: "asyncapi" },
      },
      {
        id: "a2a",
        title: "Ask an agent (A2A)",
        description: "Send a task to an agent that speaks A2A",
        example: "summarise on agent.example.com",
        synonyms: ["a2a", "agent", "ai"],
        languageTerm: "call: a2a",
        icon: "bot",
        action: { kind: "insertStep", variant: "a2a" },
      },
    ],
  },
];

export function catalogOf(
  variants: readonly StepVariant[],
  stepAbove: string | null,
): readonly CatalogGroup[] {
  const groups = CATALOG.map((group) =>
    offeredGroupOf(group, variants, stepAbove),
  );
  return groups.filter((group) => group.entries.length > 0);
}

export function entryWordsOf(
  entry: CatalogEntry,
  stepAbove: string | null,
): EntryWords {
  const own = { title: entry.title, description: entry.description };
  if (stepAbove === null) return own;
  if (entry.action.kind !== "setFailure") return own;

  return {
    title: `Retry “${stepAbove}” if it fails`,
    description: "Wraps the step above this + in a Try",
  };
}

function offeredGroupOf(
  group: CatalogGroup,
  variants: readonly StepVariant[],
  stepAbove: string | null,
): CatalogGroup {
  const entries = group.entries.filter((entry) =>
    isOffered(entry.action, variants, stepAbove),
  );
  return { id: group.id, title: group.title, entries };
}

function isOffered(
  action: EntryAction,
  variants: readonly StepVariant[],
  stepAbove: string | null,
): boolean {
  switch (action.kind) {
    case "insertStep":
      return variants.includes(action.variant);
    case "setFailure":
      return canRetry(variants, stepAbove);
    case "changeStart":
      return true;
  }
}

function canRetry(
  variants: readonly StepVariant[],
  stepAbove: string | null,
): boolean {
  if (stepAbove === null) return false;

  return variants.includes("try");
}
