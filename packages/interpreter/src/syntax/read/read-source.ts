import { LineCounter, parseDocument, type YAMLError } from "yaml";
import type { JsonValue } from "../../api/index.js";
import { isNestedDeeperThan } from "../../runtime/index.js";
import { depthLimit, tooDeepOf } from "./depth-limit.js";
import { Positions } from "./positions.js";
import { syntaxFindingOf } from "./syntax-finding.js";
import type { Reading } from "./types.js";
import { YamlReader } from "./yaml-reader.js";

const options = {
  version: "1.2",
  schema: "core",
  resolveKnownTags: false,
  uniqueKeys: true,
  keepSourceTokens: true,
  logLevel: "error",
} as const;

const loneCarriageReturn = /\r(?!\n)/g;

export function readSource(source: string | JsonValue): Reading {
  if (typeof source !== "string") {
    return readValue(source);
  }

  return readText(source);
}

export function readValue(value: JsonValue): Reading {
  const deep = isNestedDeeperThan(value, depthLimit);

  if (deep) {
    return { kind: "unreadable", finding: tooDeepOf(), range: null };
  }

  return { kind: "read", source: { document: value, positions: null } };
}

function readText(authored: string): Reading {
  // `yaml` reads no lone carriage return as a line break: each becomes a
  // line feed, one code unit for one, so every offset keeps its place.
  const text = authored.replaceAll(loneCarriageReturn, "\n");
  const lineCounter = new LineCounter();
  const parseOptions = { ...options, lineCounter };
  const parsed = parseDocument(text, parseOptions);
  const positions = new Positions(parsed, lineCounter);

  const unresolved = parsed.warnings.filter(
    ({ code }) => code === "TAG_RESOLVE_FAILED",
  );
  const [error] = [...parsed.errors, ...unresolved];

  if (error !== undefined) {
    return unparsedOf(error, positions);
  }

  const reader = new YamlReader(parsed);
  const reading = reader.read(text.length);

  if (reading.kind === "refused") {
    const range = positions.rangeOfNode(reading.node);
    return { kind: "unreadable", finding: reading.finding, range };
  }

  const source = { document: reading.value, positions };
  return { kind: "read", source };
}

function unparsedOf(error: YAMLError, positions: Positions): Reading {
  const message = error.message.replace(/ at line [\s\S]*$/, "");
  const exhausted = error.code === "RESOURCE_EXHAUSTION";
  const finding = exhausted
    ? tooDeepOf()
    : syntaxFindingOf("unparsable", [message]);

  const range = positions.rangeOfSpan(error.pos);
  return { kind: "unreadable", finding, range };
}
