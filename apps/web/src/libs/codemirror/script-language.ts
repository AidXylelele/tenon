import { autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { LanguageSupport } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { ScriptLanguage } from "./interfaces";

export function scriptLanguage(name: ScriptLanguage): Extension {
  const support = languageSupportOf(name);
  return [support, autocompletion()];
}

function languageSupportOf(name: ScriptLanguage): LanguageSupport {
  switch (name) {
    case "js":
      return javascript();
    case "python":
      return python();
  }
}
