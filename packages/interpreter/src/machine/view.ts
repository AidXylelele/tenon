import type { EffectId, StepContext } from "../api/index.js";
import type {
  EffectTemplate,
  Export,
  Expression,
  FilterTemplate,
  ListenSource,
  Program,
  Stream,
  SubscriptionSource,
  Transform,
} from "../core/index.js";
import type { ExpressionLanguage, SchemaCompiler } from "../runtime/index.js";
import type { Acceptances } from "./frames/index.js";
import type { FiberId, RunRecord, Store } from "./registers/index.js";
import type { TermTable } from "./state/index.js";
import type { Owner } from "./time/index.js";

export interface MachineServices {
  readonly expressions: ExpressionLanguage;
  readonly schemas: SchemaCompiler;
}

export type HeldTemplate = EffectTemplate | SubscriptionSource;

export interface ListenStart {
  readonly filters: readonly FilterTemplate[];
  readonly accepted: Acceptances;
}

export interface RunnerStatics {
  readonly terms: TermTable;
  readonly held: ReadonlyMap<HeldTemplate, readonly Expression[]>;
  readonly readers: ReadonlySet<EffectTemplate>;
  readonly releases: ReadonlySet<Transform | Export>;
  readonly listens: ReadonlyMap<ListenSource, ListenStart>;
  readonly triggers: ReadonlySet<Stream>;
  readonly correlating: ReadonlySet<Stream>;
}

export interface View {
  readonly program: Program;
  readonly services: MachineServices;
  readonly context: StepContext;
  readonly run: RunRecord;
  readonly store: Store;
  readonly statics: RunnerStatics;
  readonly nextFiber: FiberId;
  deadline(): Owner;
  isAnswerHeld(id: EffectId): boolean;
}
