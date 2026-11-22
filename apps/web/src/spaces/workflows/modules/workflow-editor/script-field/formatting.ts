import type { FormatOutcome } from "./interfaces";

export function formatWordsOf(
  outcome: FormatOutcome,
  formatter: string,
): string {
  switch (outcome.kind) {
    case "formatted":
      return `Formatted with ${formatter}`;
    case "refused": {
      const line = String(outcome.line);
      return `Fix line ${line} first: ${outcome.message}. ${formatter} formats only code that parses.`;
    }
    case "failed":
      return `${formatter} could not run: ${outcome.message}`;
    case "outdated":
      return `The code changed while ${formatter} formatted it; press Format again.`;
  }
}
