import type { RuntimeArgument } from "../../standard/index.js";
import type { Expression } from "../../syntax/index.js";
import type {
  BinderBinding,
  NamedComponent,
  Occurrence,
} from "../occurrences/index.js";

interface ArgumentBinding {
  readonly kind: "argument";
  readonly argument: RuntimeArgument;
}

export type Binding = ArgumentBinding | BinderBinding;

export interface ExpressionResolution {
  readonly expression: Expression;
  readonly scope: ReadonlyMap<string, Binding>;
  readonly bindings: ReadonlyMap<string, Binding>;
}

export type Resolutions = ReadonlyMap<string, ExpressionResolution>;

export interface Substitution {
  readonly component: NamedComponent | null;
  readonly occurrences: readonly Occurrence[];
}
