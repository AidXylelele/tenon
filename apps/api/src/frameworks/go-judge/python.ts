import type { JsonValue } from "interpreter";
import type { ScriptLanguage } from "./interfaces.js";

const RESERVED = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " ",
  ),
);

export class Python implements ScriptLanguage {
  readonly interpreter = "/usr/bin/python3";

  declares(name: string): boolean {
    return /^[A-Za-z_]\w*$/.test(name) && !RESERVED.has(name);
  }

  declarationOf(name: string, value: JsonValue): string {
    const json = JSON.stringify(value);
    return `${name} = __import__('json').loads(${JSON.stringify(json)})`;
  }
}
