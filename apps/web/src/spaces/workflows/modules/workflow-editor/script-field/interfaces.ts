import type { Extension } from "@codemirror/state";
import type { Diagnostic } from "vscode-languageserver-protocol";
import type { FormattingAnswer } from "@/libs/code-formatting/interfaces";
import type { ScriptLanguage } from "@/libs/codemirror/interfaces";

export type RunScriptLanguage = "js" | "python";

export interface ScriptFieldProps {
  readonly language: RunScriptLanguage;
  readonly label: string;
  readonly value: string;
  readonly problems: readonly Diagnostic[];
  readonly expanded: boolean;
  readonly onChange: (code: string) => void;
  readonly onExpandedChange: (expanded: boolean) => void;
}

export interface ScriptLanguageSettings {
  readonly library: ScriptLanguage;
  readonly title: string;
  readonly formatter: string;
  readonly extensions: Extension;
}

export type FormatOutcome = FormattingAnswer | { readonly kind: "outdated" };

export type FormatState =
  | { readonly kind: "idle" }
  | { readonly kind: "running" }
  | { readonly kind: "told"; readonly words: string };
