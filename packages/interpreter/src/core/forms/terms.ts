import type { JsonValue } from "../../api/index.js";
import type { Directive } from "./directives.js";
import type { EffectTemplate, Decoder } from "./effects.js";
import type { Catch, Retry } from "./handling.js";
import type { TermId } from "./ids.js";
import type { Iterator, Stop, StreamSource } from "./streams.js";
import type {
  Binders,
  DurationTerm,
  Expression,
  SchemaTerm,
  SlotArgument,
  Template,
} from "./values.js";

export interface Sequence {
  readonly form: "sequence";
  readonly id: TermId;
  readonly steps: readonly Term[];
}

export interface TaskList {
  readonly form: "taskList";
  readonly id: TermId;
  readonly pointer: string;
  readonly tasks: readonly TaskTerm[];
}

export interface Descriptor {
  readonly name: string;
  readonly reference: string;
  readonly definition: JsonValue;
}

export interface TaskTerm {
  readonly form: "task";
  readonly id: TermId;
  readonly descriptor: Descriptor;
  readonly then: Directive;
  readonly body: Term;
}

export interface SlotTarget {
  readonly kind: "slot";
  readonly argument: SlotArgument;
}

export interface ActivationTarget {
  readonly kind: "activation";
  readonly field: "input" | "output";
}

export interface Let {
  readonly form: "let";
  readonly id: TermId;
  readonly target: SlotTarget | ActivationTarget;
  readonly body: Term;
}

export interface Guard {
  readonly form: "guard";
  readonly id: TermId;
  readonly conditions: readonly Expression[];
  readonly body: Term;
}

export interface Transform {
  readonly form: "transform";
  readonly id: TermId;
  readonly value: Template;
}

export interface Validate {
  readonly form: "validate";
  readonly id: TermId;
  readonly schema: SchemaTerm;
}

export interface UncheckedExport {
  readonly kind: "unchecked";
}

export type ExportSchema = UncheckedExport | SchemaTerm;

export interface Export {
  readonly form: "export";
  readonly id: TermId;
  readonly value: Template;
  readonly schema: ExportSchema;
}

export interface Case {
  readonly conditions: readonly Expression[];
  readonly then: Directive;
}

export interface Choose {
  readonly form: "choose";
  readonly id: TermId;
  readonly cases: readonly Case[];
}

export interface Loop {
  readonly form: "loop";
  readonly id: TermId;
  readonly items: Template;
  readonly binders: Binders;
  readonly conditions: readonly Expression[];
  readonly body: TaskList;
}

export interface Perform {
  readonly form: "perform";
  readonly id: TermId;
  readonly effect: EffectTemplate;
  readonly decoder: Decoder;
}

export interface Raise {
  readonly form: "raise";
  readonly id: TermId;
  readonly error: Template;
}

export interface Handle {
  readonly form: "handle";
  readonly id: TermId;
  readonly body: TaskList;
  readonly catch: Catch;
  readonly retry: Retry;
}

export interface Deadline {
  readonly form: "deadline";
  readonly id: TermId;
  readonly duration: DurationTerm;
  readonly body: Term;
}

export interface Parallel {
  readonly form: "parallel";
  readonly id: TermId;
  readonly branches: readonly TaskList[];
  readonly join: "all" | "first";
}

export interface Stream {
  readonly form: "stream";
  readonly id: TermId;
  readonly source: StreamSource;
  readonly stop: Stop;
  readonly iterators: readonly Iterator[];
}

export interface Extension {
  readonly id: TermId;
  readonly index: number;
  readonly conditions: readonly Expression[];
  readonly before: readonly TaskList[];
  readonly after: readonly TaskList[];
}

export interface Extend {
  readonly form: "extend";
  readonly id: TermId;
  readonly extensions: readonly Extension[];
  readonly body: Term;
  readonly stages: Term;
}

export interface Invoke {
  readonly form: "invoke";
  readonly id: TermId;
  readonly callee: Procedure;
  readonly arguments: Template;
}

export interface Procedure {
  readonly key: string;
  readonly name: string;
  readonly body: TaskTerm;
}

export type Term =
  | Sequence
  | TaskList
  | TaskTerm
  | Let
  | Guard
  | Transform
  | Validate
  | Export
  | Choose
  | Loop
  | Perform
  | Raise
  | Handle
  | Deadline
  | Parallel
  | Stream
  | Extend
  | Invoke;
