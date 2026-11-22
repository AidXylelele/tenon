import type { JsonValue } from "interpreter/front-end";
import { childPointerOf, valueAt } from "../pointers/index.js";
import type { StepNode } from "../steps/index.js";
import { type StepVariant, variantOf } from "../variants/index.js";

type Path = readonly string[];

const httpMethod: Path = ["with", "method"];

const httpBody: Path = ["with", "body"];

const variantEssentials: Readonly<Record<StepVariant, readonly Path[]>> = {
  http: [httpMethod, ["with", "endpoint"], httpBody],
  openapi: [
    ["with", "document", "endpoint"],
    ["with", "operationId"],
    ["with", "parameters"],
  ],
  grpc: [
    ["with", "proto", "endpoint"],
    ["with", "service", "name"],
    ["with", "service", "host"],
    ["with", "method"],
    ["with", "arguments"],
  ],
  asyncapi: [
    ["with", "document", "endpoint"],
    ["with", "operation"],
    ["with", "message"],
  ],
  mcp: [
    ["with", "transport", "http", "endpoint"],
    ["with", "parameters"],
  ],
  a2a: [
    ["with", "server"],
    ["with", "parameters"],
  ],
  "script-js": [
    ["run", "script", "language"],
    ["run", "script", "code"],
    ["run", "script", "arguments"],
  ],
  "script-python": [
    ["run", "script", "language"],
    ["run", "script", "code"],
    ["run", "script", "arguments"],
  ],
  shell: [["run", "shell", "command"]],
  container: [
    ["run", "container", "image"],
    ["run", "container", "command"],
  ],
  workflow: [
    ["run", "workflow", "namespace"],
    ["run", "workflow", "name"],
    ["run", "workflow", "version"],
    ["run", "workflow", "input"],
  ],
  do: [],
  emit: [
    ["emit", "event", "with", "type"],
    ["emit", "event", "with", "data"],
  ],
  for: [
    ["for", "in"],
    ["for", "each"],
  ],
  fork: [
    ["fork", "branches"],
    ["fork", "compete"],
  ],
  listen: [["listen", "to"]],
  raise: [
    ["raise", "error", "title"],
    ["raise", "error", "type"],
    ["raise", "error", "status"],
  ],
  set: [["set"]],
  switch: [["switch"]],
  try: [
    ["catch", "retry"],
    ["catch", "do"],
  ],
  wait: [["wait"]],
};

const functionCallEssentials: readonly Path[] = [["with"]];

const workflowEssentials: readonly string[] = ["/document/title", "/schedule"];

const sendingMethods: ReadonlySet<string> = new Set(["post", "put", "patch"]);

export function stepEssentialsOf(
  node: StepNode,
  document: JsonValue,
): ReadonlyMap<string, number> {
  const variant = variantOf(node.task);
  const paths =
    variant === null ? functionCallEssentials : variantEssentials[variant];
  const shown = paths.filter((path) => isShownOf(path, node, document));
  const pointers = shown.map((path) => pointerOf(node, path));

  return rankedOf(pointers);
}

export function workflowEssentialsOf(): ReadonlyMap<string, number> {
  return rankedOf(workflowEssentials);
}

function isShownOf(path: Path, node: StepNode, document: JsonValue): boolean {
  const isBody = path === httpBody;

  if (!isBody) {
    return true;
  }

  const methodPointer = pointerOf(node, httpMethod);
  const method = valueAt(document, methodPointer);
  const isText = typeof method === "string";

  if (!isText) {
    return false;
  }

  const lowered = method.toLowerCase();
  return sendingMethods.has(lowered);
}

function pointerOf(node: StepNode, path: Path): string {
  return path.reduce(childPointerOf, node.pointer);
}

function rankedOf(pointers: readonly string[]): ReadonlyMap<string, number> {
  const ranks = pointers.map((pointer, rank) => [pointer, rank] as const);

  return new Map(ranks);
}
