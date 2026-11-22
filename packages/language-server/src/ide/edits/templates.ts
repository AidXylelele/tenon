import type { JsonObject, TaskKind } from "interpreter/front-end";
import type { StepNodeList } from "../steps/index.js";

export function templateOf(kind: TaskKind): JsonObject {
  switch (kind) {
    case "call":
      return {
        call: "http",
        with: { method: "get", endpoint: "https://example.com" },
      };
    case "do":
      return { do: [] };
    case "emit":
      return {
        emit: {
          event: {
            with: { source: "https://example.com", type: "com.example.event" },
          },
        },
      };
    case "for":
      return { for: { each: "item", in: "${ .items }" }, do: [] };
    case "fork":
      return { fork: { branches: [] } };
    case "listen":
      return {
        listen: { to: { one: { with: { type: "com.example.event" } } } },
      };
    case "raise":
      return {
        raise: {
          error: { type: "https://example.com/errors/failed", status: 500 },
        },
      };
    case "run":
      return { run: { shell: { command: "echo hello" } } };
    case "set":
      return { set: { result: true } };
    case "switch":
      return { switch: [{ default: { then: "continue" } }] };
    case "try":
      return { try: [], catch: {} };
    case "wait":
      return { wait: "PT1S" };
  }
}

export function newNameOf(list: StepNodeList, base: string): string {
  const taken = namesOf(list);
  const isTaken = taken.has(base);

  return isTaken ? numberedNameOf(taken, base, 2) : base;
}

export function copyNameOf(list: StepNodeList, name: string): string {
  const taken = namesOf(list);

  return numberedNameOf(taken, name, 2);
}

function namesOf(list: StepNodeList): ReadonlySet<string> {
  const names = list.steps.map((step) => step.name);

  return new Set(names);
}

function numberedNameOf(
  taken: ReadonlySet<string>,
  base: string,
  numeral: number,
): string {
  const written = String(numeral);
  const candidate = `${base}-${written}`;
  const isTaken = taken.has(candidate);

  return isTaken ? numberedNameOf(taken, base, numeral + 1) : candidate;
}
