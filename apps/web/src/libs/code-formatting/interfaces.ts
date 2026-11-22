import type { ScriptLanguage } from "@/libs/codemirror/interfaces";

export interface FormattingRequest {
  readonly language: ScriptLanguage;
  readonly text: string;
}

export interface Formatted {
  readonly kind: "formatted";
  readonly text: string;
}

export interface Refused {
  readonly kind: "refused";
  readonly message: string;
  readonly line: number;
}

export interface Failed {
  readonly kind: "failed";
  readonly message: string;
}

export type Formatting = Formatted | Refused;

export type FormattingAnswer = Formatting | Failed;
