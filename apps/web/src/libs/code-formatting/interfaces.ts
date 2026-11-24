import type { CodeProblem, ScriptLanguage } from "@/libs/codemirror/interfaces";

export type WorkerRequest =
  | {
      readonly kind: "format";
      readonly language: ScriptLanguage;
      readonly text: string;
      readonly cursor: number;
    }
  | {
      readonly kind: "check";
      readonly language: ScriptLanguage;
      readonly text: string;
    };

export interface Formatted {
  readonly kind: "formatted";
  readonly text: string;
  readonly cursor: number;
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

export interface Checked {
  readonly kind: "checked";
  readonly problems: readonly CodeProblem[];
}

export type Formatting = Formatted | Refused | Failed;

export type WorkerAnswer = Formatted | Refused | Checked | Failed;
