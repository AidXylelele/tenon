import { autocompletion } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import { type Extension, Prec } from "@codemirror/state";
import type { ScriptLanguage } from "@/libs/codemirror/interfaces";
import { scriptLanguage } from "@/libs/codemirror/script-language";
import { tokenTheme } from "@/libs/codemirror/theme";
import type { RunScriptLanguage, ScriptLanguageSettings } from "./interfaces";

export const SCRIPT_LANGUAGES: Readonly<
  Record<RunScriptLanguage, ScriptLanguageSettings>
> = {
  js: {
    library: "javascript",
    title: "JavaScript · ES2024",
    formatter: "Prettier",
    extensions: extensionsOf("javascript"),
  },
  python: {
    library: "python",
    title: "Python 3.13",
    formatter: "Ruff",
    extensions: extensionsOf("python"),
  },
};

function extensionsOf(language: ScriptLanguage): Extension {
  const support = scriptLanguage(language);
  const look = tokenTheme();
  const completion = autocompletion();
  const markers = lintGutter();
  const firstGutter = Prec.high(markers);
  return [support, look, completion, firstGutter];
}
