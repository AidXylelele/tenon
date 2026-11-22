import type { DataShape } from "language-server/protocol";
import type { Json, SampleMember } from "./interfaces";
import { memberPathOf, valueOf } from "./paths";

const DEPTH = 3;

export function sampleMembersOf(
  expression: string,
  sample: Json,
): readonly SampleMember[] {
  return membersOf(expression, sample, DEPTH);
}

function membersOf(
  expression: string,
  sample: Json,
  depth: number,
): readonly SampleMember[] {
  const isObject =
    typeof sample === "object" && sample !== null && !Array.isArray(sample);

  if (!isObject || depth === 0) return [];

  return Object.entries(sample).map(([name, held]) => {
    const path = memberPathOf(expression, name);
    const shape = shapeOf(held);
    const size = Array.isArray(held) ? held.length : null;
    const members = membersOf(path, held, depth - 1);
    const value = valueOf(path);
    return { name, expression: path, value, shape, size, members };
  });
}

export function shapeOf(sample: Json): DataShape {
  if (Array.isArray(sample)) return "list";

  switch (typeof sample) {
    case "string":
      return "text";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return sample === null ? "unknown" : "object";
  }
}
