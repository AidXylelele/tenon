import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { LanguageSupport } from "@codemirror/language";
import type { ScriptLanguage } from "./interfaces";

export function scriptLanguage(name: ScriptLanguage): LanguageSupport {
  switch (name) {
    case "javascript":
      return javascript();
    case "python":
      return python();
  }
}
