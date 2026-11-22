import { formatScript } from "@/libs/code-formatting/format-script";
import type { FormattingAnswer } from "@/libs/code-formatting/interfaces";
import type { FormatOutcome, ScriptLanguageSettings } from "./interfaces";

export async function answerOf(
  settings: ScriptLanguageSettings,
  text: string,
): Promise<FormattingAnswer> {
  try {
    return await formatScript(settings.library, text);
  } catch (error) {
    const message = reasonOf(error);
    return { kind: "failed", message };
  }
}

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

function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.message;

  return String(error);
}
