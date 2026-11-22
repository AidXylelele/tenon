import type { JsonValue } from "interpreter";
import type { ScriptLanguage } from "./interfaces.js";

const RESERVED = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public arguments eval".split(
    " ",
  ),
);

export class JavaScript implements ScriptLanguage {
  readonly interpreter = "/usr/local/bin/node";

  declares(name: string): boolean {
    return /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED.has(name);
  }

  declarationOf(name: string, value: JsonValue): string {
    return `const ${name} = ${JSON.stringify(value)};`;
  }
}
