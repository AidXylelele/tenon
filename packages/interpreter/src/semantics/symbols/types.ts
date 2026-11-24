import type { Import, JsonValue } from "../../api/index.js";
import type {
  AuthenticationPolicy,
  ErrorDefinition,
  Finding,
  LabelDirective,
  Reference,
  RetryPolicy,
  Secret,
  Task,
  TaskList,
  Timeout,
} from "../../syntax/index.js";
import type { ListRole, Occurrence } from "../occurrences/index.js";
import type { ImportPlace } from "../uris/index.js";

export interface DeclaredFunction {
  readonly origin: "declared";
  readonly name: string;
  readonly task: Task;
}

export interface ImportedFunction {
  readonly origin: "imported";
  readonly name: string;
  readonly task: Task;
  readonly site: string;
  readonly definition: JsonValue;
}

export type FunctionSymbol = DeclaredFunction | ImportedFunction;

export interface ComponentTable {
  readonly authentications: ReadonlyMap<string, AuthenticationPolicy>;
  readonly errors: ReadonlyMap<string, ErrorDefinition>;
  readonly retries: ReadonlyMap<string, RetryPolicy>;
  readonly timeouts: ReadonlyMap<string, Timeout>;
  readonly functions: ReadonlyMap<string, FunctionSymbol>;
  readonly secrets: ReadonlyMap<string, Secret>;
}

type LabelTables = ReadonlyMap<string, ReadonlyMap<string, number>>;

export interface ReferenceTable {
  readonly authentications: ReadonlyMap<string, AuthenticationPolicy>;
  readonly errors: ReadonlyMap<string, ErrorDefinition>;
  readonly retries: ReadonlyMap<string, RetryPolicy>;
  readonly timeouts: ReadonlyMap<string, Timeout>;
  readonly functions: ReadonlyMap<string, FunctionSymbol>;
  readonly secrets: ReadonlyMap<string, Secret>;
}

export interface Symbols {
  readonly components: ComponentTable;
  readonly labels: LabelTables;
  readonly jumps: ReadonlyMap<string, string>;
  readonly references: ReferenceTable;
  readonly schemas: ReadonlyMap<string, ReadSchema>;
}

export interface SymbolAnalysis {
  readonly symbols: Symbols;
  readonly occurrences: readonly Occurrence[];
  readonly findings: readonly Finding[];
}

type ComponentKind = keyof ComponentTable;

export interface ComponentReference {
  readonly table: ComponentKind;
  readonly reference: Reference;
}

export interface Placement {
  readonly task: Task;
  readonly role: ListRole;
  readonly names: ReadonlyMap<string, number>;
  readonly tasks: readonly Task[];
}

export type LabelTarget =
  | {
      readonly kind: "found";
      readonly label: LabelDirective;
      readonly task: Task;
    }
  | { readonly kind: "unknown"; readonly label: LabelDirective }
  | { readonly kind: "crossing"; readonly label: LabelDirective };

export interface ListLabels {
  readonly list: TaskList;
  readonly names: ReadonlyMap<string, number>;
  readonly targets: readonly LabelTarget[];
}

export interface Labelling {
  readonly labels: LabelTables;
  readonly jumps: ReadonlyMap<string, string>;
  readonly findings: readonly Finding[];
}

export interface Resolution {
  readonly references: ReferenceTable;
  readonly findings: readonly Finding[];
}

export interface CatalogReference {
  readonly name: string;
  readonly version: string;
  readonly catalog: string;
}

export type Callee =
  | { readonly kind: "declared" }
  | { readonly kind: "imported"; readonly import: Import }
  | { readonly kind: "unlinked"; readonly catalog: string }
  | { readonly kind: "undeclaredFunction" }
  | { readonly kind: "undeclaredCatalog"; readonly catalog: string };

interface ReadFunction {
  readonly kind: "read";
  readonly function: ImportedFunction;
  readonly occurrences: readonly Occurrence[];
}

export type ImportReading =
  { readonly kind: "unfetched" } | { readonly kind: "invalid" } | ReadFunction;

export interface FunctionLinking {
  readonly functions: ReadonlyMap<string, ImportedFunction>;
  readonly occurrences: readonly Occurrence[];
  readonly findings: readonly Finding[];
}

export interface Named {
  readonly pointer: string;
  readonly name: string;
}

export type NameMessage =
  | "duplicateTask"
  | "unknownTask"
  | "branchJump"
  | "undeclaredFunction"
  | "undeclaredError"
  | "undeclaredRetry"
  | "undeclaredTimeout"
  | "undeclaredAuthentication"
  | "undeclaredCatalog"
  | "importNotTask"
  | "recursiveFunction";

export interface ReadSchema {
  readonly places: readonly ImportPlace[];
  readonly document: JsonValue;
}

export type SchemaEntry = readonly [string, ReadSchema];

export type SchemaReading =
  | { readonly kind: "unfetched" }
  | { readonly kind: "unreadable" }
  | { readonly kind: "read"; readonly document: JsonValue };

export interface ImportedSchema {
  readonly uri: string;
  readonly places: readonly ImportPlace[];
  readonly reading: SchemaReading;
}

export interface SchemaLinking {
  readonly schemas: ReadonlyMap<string, ReadSchema>;
  readonly findings: readonly Finding[];
}
