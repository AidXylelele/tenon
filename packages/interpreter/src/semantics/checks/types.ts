import type { HostProfile } from "../../api/index.js";
import type {
  ExpressionLanguage,
  SchemaCompiler,
} from "../../runtime/index.js";
import type {
  AuthenticationPolicy,
  Finding,
  Reference,
  Workflow,
} from "../../syntax/index.js";
import type { Occurrence } from "../occurrences/index.js";
import type { Resolutions } from "../resolve/index.js";
import type { Symbols } from "../symbols/index.js";

export interface CheckSubject {
  readonly workflow: Workflow;
  readonly symbols: Symbols;
  readonly occurrences: readonly Occurrence[];
  readonly resolutions: Resolutions;
  readonly profile: HostProfile;
  readonly expressions: ExpressionLanguage;
  readonly schemas: SchemaCompiler;
}

export type Check = (subject: CheckSubject) => readonly Finding[];

export type Authentication = AuthenticationPolicy | Reference;
