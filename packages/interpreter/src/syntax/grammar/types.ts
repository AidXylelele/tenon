import type { JsonObject, JsonValue } from "../../api/index.js";
import type { Validator } from "../../runtime/index.js";
import type { Finding } from "../findings.js";
import type { JsonType } from "./json-types.js";

type ReferenceRule =
  | "unnamedAgent"
  | "eventWithoutProperties"
  | "unsupportedLanguage"
  | "competitionWithoutBranches";

export interface Located {
  readonly pointer: string;
  readonly instance: string;
  readonly keyword: string;
}

export interface SchemaBreach extends Located {
  readonly kind: "schema";
  readonly problem: string;
  readonly value: JsonValue;
  readonly pattern: string | null;
}

export interface RuleBreach extends Located {
  readonly kind: "rule";
  readonly rule: ReferenceRule;
}

export type Violation = SchemaBreach | RuleBreach;

export type KeywordRole = "value" | "choice" | "alternative" | "structure";

interface Malformed {
  readonly kind: "malformed";
  readonly findings: readonly Finding[];
}

interface Formed {
  readonly kind: "formed";
  readonly findings: readonly Finding[];
}

export type Verdict = Malformed | Formed;

export interface SchemaMember {
  readonly name: string;
  readonly required: boolean;
  readonly description: string | null;
}

export interface SchemaAt {
  readonly description: string | null;
  readonly types: readonly JsonType[];
  readonly values: readonly JsonValue[];
  readonly closed: boolean;
  readonly members: readonly SchemaMember[];
}

export interface SchemaPlace {
  readonly node: JsonObject;
  readonly value: JsonValue;
}

export type Levelling = (place: SchemaPlace) => readonly SchemaPlace[];

export interface Definition {
  readonly validate: Validator;
  readonly nodes: readonly JsonObject[];
}

export interface CallBranch extends Definition {
  readonly accepts: Validator;
}
