import type { Diagnostic, JsonValue, Range } from "../../api/index.js";
import {
  childPointerOf,
  isJsonArray,
  isJsonObject,
  rootPointer,
} from "../../runtime/index.js";
import type { Finding, SourceDocument } from "../../syntax/index.js";
import { messageOf, type Root } from "./messages.js";

type Entry = readonly [key: string, value: JsonValue];

const none: readonly Entry[] = [];

export function diagnosticOf(
  finding: Finding,
  range: Range | null,
  root: Root,
): Diagnostic {
  const message = messageOf(finding, root);

  return {
    code: finding.code,
    message,
    pointer: finding.pointer,
    range,
    subject: finding.subject,
    import: finding.import,
  };
}

export function diagnosticsOf(
  findings: readonly Finding[],
  source: SourceDocument,
  root: Root,
): readonly Diagnostic[] {
  const unique = uniqueOf(findings);
  const ordered = inDocumentOrder(unique, source.document);

  return ordered.map((finding) => {
    const range = source.positions?.rangeOf(finding.pointer) ?? null;
    return diagnosticOf(finding, range, root);
  });
}

function uniqueOf(findings: readonly Finding[]): readonly Finding[] {
  const groups = Map.groupBy(findings, keyOf);
  const repeated = [...groups.values()];

  return repeated.flatMap((group) => group.slice(0, 1));
}

function keyOf(finding: Finding): string {
  return [finding.code, finding.pointer, finding.subject].join("\n");
}

function inDocumentOrder(
  findings: readonly Finding[],
  document: JsonValue,
): readonly Finding[] {
  const pointers = pointersOf(document, rootPointer);
  const held = pointers.map((pointer, index) => [pointer, index] as const);
  const found = findings.map(
    ({ pointer }, index) => [pointer, pointers.length + index] as const,
  );
  const firstFound = found.toReversed();
  const ranked = [...firstFound, ...held];
  const ranks = new Map(ranked);

  return findings.toSorted(
    (left, right) => rankOf(left, ranks) - rankOf(right, ranks),
  );
}

function pointersOf(value: JsonValue, pointer: string): readonly string[] {
  const inside = entriesOf(value).flatMap(([key, child]) => {
    const childPointer = childPointerOf(pointer, key);
    return pointersOf(child, childPointer);
  });

  return [pointer, ...inside];
}

function entriesOf(value: JsonValue): readonly Entry[] {
  const isArray = isJsonArray(value);

  if (isArray) {
    return value.map((child, index) => [String(index), child] as const);
  }

  const isObject = isJsonObject(value);

  if (isObject) {
    return Object.entries(value);
  }

  return none;
}

function rankOf(finding: Finding, ranks: ReadonlyMap<string, number>): number {
  return ranks.get(finding.pointer) ?? 0;
}
