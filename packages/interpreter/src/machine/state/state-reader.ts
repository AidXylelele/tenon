import { List } from "immutable";
import type { JsonObject, JsonValue } from "../../api/index.js";
import type { Descriptor, Term } from "../../core/index.js";
import { InterpreterError, isJsonArray } from "../../runtime/index.js";
import type { Path } from "../identity/index.js";
import { Environment, type Scope, scopeOf } from "../registers/index.js";
import {
  type FormOf,
  type KindSet,
  arrayAt,
  fieldAt,
  formOf,
  indexAt,
  kindAt,
  objectAt,
} from "./fields.js";
import { decodeLink } from "./identity-codec.js";
import type { TermTable } from "./term-table.js";

const descriptorKinds: KindSet<"workflow" | "task"> = {
  workflow: true,
  task: true,
};

export class StateReader {
  readonly #terms: TermTable;
  readonly #environments: List<Environment>;
  readonly #paths: List<Path>;

  constructor(
    terms: TermTable,
    environments: readonly JsonObject[],
    paths: readonly JsonObject[],
  ) {
    const noEnvironments = List<Environment>();
    const noPaths = List<Path>();

    this.#terms = terms;
    this.#environments = environments.reduce(
      (decoded, entry) => this.#extendedBy(decoded, entry),
      noEnvironments,
    );
    this.#paths = paths.reduce(
      (decoded, link) => this.#linkedBy(decoded, link),
      noPaths,
    );
  }

  termsAt(encoded: JsonObject, key: string): readonly Term[] {
    const refs = arrayAt(encoded, key);

    return refs.map((ref) => this.#termOf(ref, key));
  }

  formAt<Form extends Term["form"]>(
    encoded: JsonObject,
    key: string,
    form: Form,
  ): FormOf<Form> {
    const term = this.#termAt(encoded, key);

    return formOf(term, form);
  }

  scopeAt(encoded: JsonObject, key: string): Scope {
    const scope = objectAt(encoded, key);
    const index = indexAt(scope, "environment");
    const environment = this.#environmentAt(index);
    const activation = indexAt(scope, "activation");
    const path = this.pathAt(scope, "path");

    return scopeOf(environment, activation, path);
  }

  descriptorAt(encoded: JsonObject, key: string): Descriptor {
    const named = objectAt(encoded, key);
    const kind = kindAt(named, descriptorKinds);

    switch (kind) {
      case "workflow":
        return this.#terms.workflowDescriptor;
      case "task": {
        const task = this.formAt(named, "task", "task");
        return task.descriptor;
      }
    }
  }

  pathAt(encoded: JsonObject, key: string): Path {
    const index = indexAt(encoded, key);
    const path = this.#paths.get(index);

    if (path === undefined) {
      throw new InterpreterError(`The state holds no path ${String(index)}.`);
    }

    return path;
  }

  #termAt(encoded: JsonObject, key: string): Term {
    const ref = fieldAt(encoded, key);

    return this.#termOf(ref, key);
  }

  #termOf(ref: JsonValue, key: string): Term {
    const isPair = isJsonArray(ref);
    const pair = isPair ? ref : [];
    const root = pair[0];
    const id = pair[1];

    const isNamed = typeof root === "string" && typeof id === "string";

    if (!isNamed) {
      throw new InterpreterError(`The state names no term at '${key}'.`);
    }

    return this.#terms.termOf({ root, id });
  }

  #extendedBy(
    decoded: List<Environment>,
    entry: JsonObject,
  ): List<Environment> {
    const environment = this.#environmentOf(entry, decoded);

    return decoded.push(environment);
  }

  #linkedBy(decoded: List<Path>, link: JsonObject): List<Path> {
    const path = decodeLink(link, decoded);

    return decoded.push(path);
  }

  #environmentOf(entry: JsonObject, decoded: List<Environment>): Environment {
    const enclosing = fieldAt(entry, "enclosing");

    if (enclosing === null) {
      return Environment.empty;
    }

    const index = indexAt(entry, "enclosing");
    const outer = decoded.get(index);

    if (outer === undefined) {
      throw new InterpreterError(
        `An environment of the state extends ${String(index)}, which is not before it.`,
      );
    }

    const slots = arrayAt(entry, "slots");
    return outer.extended(slots);
  }

  #environmentAt(index: number): Environment {
    const environment = this.#environments.get(index);

    if (environment === undefined) {
      throw new InterpreterError(
        `The state holds no environment ${String(index)}.`,
      );
    }

    return environment;
  }
}
