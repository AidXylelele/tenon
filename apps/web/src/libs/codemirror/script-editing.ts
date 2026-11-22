import { autocompletion } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import type { ScriptLanguage } from "./interfaces";
import { scriptLanguage } from "./script-language";
import { tokenTheme } from "./theme";

export function scriptEditing(language: ScriptLanguage): Extension {
  const support = scriptLanguage(language);
  const look = tokenTheme();
  const completion = autocompletion();
  const problems = lintGutter();
  return [support, look, completion, problems];
}
