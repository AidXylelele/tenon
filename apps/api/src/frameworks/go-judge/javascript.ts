import type { JsonValue } from "interpreter";
import type { ScriptLanguage } from "./interfaces.js";

export class JavaScript implements ScriptLanguage {
  private static readonly RESERVED: ReadonlySet<string> = new Set([
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "let",
    "static",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public",
    "arguments",
    "eval",
  ]);

  readonly interpreter = "/usr/local/bin/node";

  declares(name: string): boolean {
    const identifier = /^[A-Za-z_$][\w$]*$/.test(name);
    const reserved = JavaScript.RESERVED.has(name);
    return identifier && !reserved;
  }

  declarationOf(name: string, value: JsonValue): string {
    return `const ${name} = ${JSON.stringify(value)};`;
  }
}
