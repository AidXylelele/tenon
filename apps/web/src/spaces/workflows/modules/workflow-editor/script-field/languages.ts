import { checkScript } from "@/libs/code-formatting/format-script";
import type { Extension } from "@codemirror/state";
import type { ScriptLanguage } from "@/libs/codemirror/interfaces";
import { lineProblemLinter } from "@/libs/codemirror/line-problems";
import { scriptEditing } from "@/libs/codemirror/script-editing";
import type { RunScriptLanguage, ScriptLanguageSettings } from "./interfaces";

export const SCRIPT_LANGUAGES: Readonly<
  Record<RunScriptLanguage, ScriptLanguageSettings>
> = {
  js: {
    library: "javascript",
    title: "JavaScript · ES2024",
    extensions: extensionsOf("javascript"),
  },
  python: {
    library: "python",
    title: "Python 3.13",
    extensions: extensionsOf("python"),
  },
};

function extensionsOf(language: ScriptLanguage): Extension {
  const editing = scriptEditing(language);
  const checking = lineProblemLinter((text) => checkScript(language, text));
  return [editing, checking];
}
