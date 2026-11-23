import type { JsonValue, SchemaMember } from "interpreter/front-end";
import type { SchemasAt } from "../places/index.js";
import type { Problem } from "../snapshot/index.js";
import type { FailureKind } from "../steps/index.js";
import type { RetryPlan } from "../structure/index.js";
import type { ResultReading } from "../variants/index.js";

export type FormSection = "settings" | "failure" | "data" | "note";

export type FormInput =
  | "text"
  | "number"
  | "boolean"
  | "choice"
  | "duration"
  | "group"
  | "oneOf"
  | "structured";

export interface FormField<Report = Problem> {
  readonly key: string;
  readonly title: string;
  readonly pointer: string;
  readonly section: FormSection;
  readonly description: string | null;
  readonly input: FormInput;
  readonly choices: readonly JsonValue[];
  readonly required: boolean;
  readonly written: boolean;
  readonly suggested: boolean;
  readonly value: JsonValue;
  readonly essentialRank: number | null;
  readonly fields: readonly FormField<Report>[];
  readonly diagnostics: readonly Report[];
}

export type MemberField = Omit<FormField, "section" | "fields">;

export interface FormRefusal {
  readonly kind: "refused";
  readonly reason: string;
}

export type WorkflowFormReading =
  | { readonly kind: "form"; readonly fields: readonly FormField[] }
  | FormRefusal;

export interface WorkflowMember {
  readonly holder: string;
  readonly name: string;
  readonly section: FormSection;
  readonly requires: string | null;
  readonly fields: "members" | "triggers";
}

export interface PlacedMember {
  readonly member: SchemaMember;
  readonly holder: string;
  readonly section: FormSection;
}

export type StepFormReading =
  | {
      readonly kind: "form";
      readonly failure: FailureKind;
      readonly retry: RetryPlan | null;
      readonly result: ResultReading | null;
      readonly fields: readonly FormField[];
    }
  | FormRefusal;

export interface FieldSources {
  readonly document: JsonValue;
  readonly schemasAt: SchemasAt;
  readonly diagnostics: readonly Problem[];
  readonly suggestions: ReadonlyMap<string, readonly JsonValue[]>;
  readonly essentials: ReadonlyMap<string, number>;
}
