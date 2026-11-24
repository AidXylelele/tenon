import type { JsonValue } from "../../api/index.js";
import { type Path, rootPath } from "../identity/index.js";
import type { Address } from "./activation.js";
import { Environment } from "./environment.js";

export interface Scope {
  readonly environment: Environment;
  readonly activation: Address;
  readonly path: Path;
}

export interface Here {
  readonly scope: Scope;
  readonly value: JsonValue;
}

export function scopeOf(
  environment: Environment,
  activation: Address,
  path: Path,
): Scope {
  return { environment, activation, path };
}

export function rootScopeOf(activation: Address): Scope {
  return scopeOf(Environment.empty, activation, rootPath);
}

export function withEnvironment(scope: Scope, environment: Environment): Scope {
  return scopeOf(environment, scope.activation, scope.path);
}

export function withActivation(scope: Scope, activation: Address): Scope {
  return scopeOf(scope.environment, activation, scope.path);
}

export function withPath(scope: Scope, path: Path): Scope {
  return scopeOf(scope.environment, scope.activation, path);
}
