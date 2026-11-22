import type { ExtensionTarget } from "../../standard/index.js";
import type { Expression } from "./data.js";
import type { AuthenticationPolicy, Endpoint } from "./endpoints.js";
import type { ErrorDefinition, RetryPolicy, Timeout } from "./errors.js";
import type { Task, TaskList } from "./tasks.js";

export interface Use {
  readonly pointer: string;
  readonly authentications: ReadonlyMap<string, AuthenticationPolicy>;
  readonly catalogs: ReadonlyMap<string, Catalog>;
  readonly errors: ReadonlyMap<string, ErrorDefinition>;
  readonly extensions: readonly Extension[];
  readonly functions: ReadonlyMap<string, Task>;
  readonly retries: ReadonlyMap<string, RetryPolicy>;
  readonly secrets: readonly Secret[];
  readonly timeouts: ReadonlyMap<string, Timeout>;
}

export interface Catalog {
  readonly pointer: string;
  readonly endpoint: Endpoint;
}

export interface Extension {
  readonly pointer: string;
  readonly extend: ExtensionTarget;
  readonly when: Expression | null;
  readonly before: TaskList | null;
  readonly after: TaskList | null;
}

export interface Secret {
  readonly pointer: string;
  readonly name: string;
}
