import { compiledPatternOf } from "../../runtime/index.js";
import type {
  EventFilter,
  FilterAttribute,
  Finding,
  PatternAttribute,
} from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

const none: readonly PatternAttribute[] = [];

export function checkRegexes(subject: CheckSubject): readonly Finding[] {
  const filters = subject.occurrences
    .filter((occurrence) => occurrence.kind === "filter")
    .map((occurrence) => occurrence.filter);
  const patterns = filters.flatMap(patternsOf);
  const invalid = patterns.filter(
    (pattern) => compiledPatternOf(pattern.pattern) === null,
  );

  return invalid.map(invalidRegexOf);
}

function patternsOf(filter: EventFilter): readonly PatternAttribute[] {
  const attributes = [...filter.with.attributes.values()];
  return attributes.flatMap(patternOf);
}

function patternOf(attribute: FilterAttribute): readonly PatternAttribute[] {
  switch (attribute.kind) {
    case "pattern":
      return [attribute];
    case "condition":
    case "value":
      return none;
  }
}

function invalidRegexOf(pattern: PatternAttribute): Finding<"invalidRegex"> {
  return {
    name: "invalidRegex",
    code: "regex",
    pointer: pattern.pointer,
    subject: null,
    details: [pattern.pattern],
    import: null,
  };
}
