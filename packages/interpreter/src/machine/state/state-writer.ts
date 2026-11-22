import type { JsonArray, JsonObject } from "../../api/index.js";
import type { Descriptor, Term } from "../../core/index.js";
import type { Path } from "../identity/index.js";
import type { Environment, Scope } from "../registers/index.js";
import { encodeLink } from "./identity-codec.js";
import type { TermTable } from "./term-table.js";

export class StateWriter {
  readonly #terms: TermTable;
  readonly #environmentIndices: Map<Environment, number>;
  readonly #environments: JsonObject[];
  readonly #pathIndices: Map<Path, number>;
  readonly #paths: JsonObject[];

  constructor(terms: TermTable) {
    this.#terms = terms;
    this.#environmentIndices = new Map();
    this.#environments = [];
    this.#pathIndices = new Map();
    this.#paths = [];
  }

  get environments(): JsonArray {
    return this.#environments;
  }

  get paths(): JsonArray {
    return this.#paths;
  }

  encodeTerm(term: Term): JsonArray {
    const ref = this.#terms.refOf(term);

    return [ref.root, ref.id];
  }

  encodeTerms(terms: readonly Term[]): JsonArray {
    return terms.map((term) => this.encodeTerm(term));
  }

  encodeDescriptor(descriptor: Descriptor): JsonObject {
    const isWorkflow = descriptor === this.#terms.workflowDescriptor;

    if (isWorkflow) {
      return { kind: "workflow" };
    }

    const owner = this.#terms.taskOf(descriptor);
    const task = this.encodeTerm(owner);
    return { kind: "task", task };
  }

  encodeScope(scope: Scope): JsonObject {
    const environment = this.#environmentIndexOf(scope.environment);
    const path = this.encodePath(scope.path);

    return { environment, activation: scope.activation, path };
  }

  encodePath(path: Path): number {
    const known = this.#pathIndices.get(path);

    if (known !== undefined) {
      return known;
    }

    const link = encodeLink(path, this);
    const index = this.#paths.length;

    this.#paths.push(link);
    this.#pathIndices.set(path, index);
    return index;
  }

  #environmentIndexOf(environment: Environment): number {
    const known = this.#environmentIndices.get(environment);

    if (known !== undefined) {
      return known;
    }

    const enclosing = this.#enclosingIndexOf(environment);
    const index = this.#environments.length;

    this.#environments.push({ enclosing, slots: environment.slots });
    this.#environmentIndices.set(environment, index);
    return index;
  }

  #enclosingIndexOf(environment: Environment): number | null {
    const enclosing = environment.enclosing;

    switch (enclosing.kind) {
      case "outermost":
        return null;
      case "enclosed":
        return this.#environmentIndexOf(enclosing.environment);
    }
  }
}
