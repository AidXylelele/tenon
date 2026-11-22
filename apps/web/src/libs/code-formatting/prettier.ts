import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import { format } from "prettier/standalone";
import { z } from "zod";
import type { Formatting } from "./interfaces";

const OPTIONS = { parser: "babel", plugins: [babel, estree] };

const PARSE_ERROR = z.object({
  message: z.string(),
  loc: z.object({ start: z.object({ line: z.number() }) }),
});

export async function formatJavaScript(text: string): Promise<Formatting> {
  try {
    const formatted = await format(text, OPTIONS);
    return { kind: "formatted", text: formatted };
  } catch (error) {
    const parsed = PARSE_ERROR.safeParse(error);

    if (!parsed.success) throw error;

    const { message, loc } = parsed.data;
    const [withoutCodeFrame = message] = message.split("\n", 1);
    return { kind: "refused", message: withoutCodeFrame, line: loc.start.line };
  }
}
