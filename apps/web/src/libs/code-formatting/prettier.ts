import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import { format, formatWithCursor } from "prettier/standalone";
import { z } from "zod";
import type { CodeProblem } from "@/libs/codemirror/interfaces";
import type { Formatted, Refused } from "./interfaces";

const OPTIONS = { parser: "babel", plugins: [babel, estree] };

const PARSE_ERROR = z.object({
  message: z.string(),
  codeFrame: z.string(),
  loc: z.object({ start: z.object({ line: z.number() }) }),
});

export async function formatJavaScript(
  text: string,
  cursor: number,
): Promise<Formatted | Refused> {
  try {
    const options = {
      parser: OPTIONS.parser,
      plugins: OPTIONS.plugins,
      cursorOffset: cursor,
    };
    const result = await formatWithCursor(text, options);
    return {
      kind: "formatted",
      text: result.formatted,
      cursor: result.cursorOffset,
    };
  } catch (error) {
    const refusal = refusalOf(error);

    if (refusal === null) throw error;

    return refusal;
  }
}

export async function checkJavaScript(
  text: string,
): Promise<readonly CodeProblem[]> {
  try {
    await format(text, OPTIONS);
    return [];
  } catch (error) {
    const refusal = refusalOf(error);

    if (refusal === null) throw error;

    return [
      { line: refusal.line, message: refusal.message, severity: "error" },
    ];
  }
}

function refusalOf(error: unknown): Refused | null {
  const parsed = PARSE_ERROR.safeParse(error);

  if (!parsed.success) return null;

  const { message, codeFrame, loc } = parsed.data;
  const appended = `\n${codeFrame}`;
  const end = message.length - appended.length;
  const withoutCodeFrame = message.slice(0, end);
  return { kind: "refused", message: withoutCodeFrame, line: loc.start.line };
}
