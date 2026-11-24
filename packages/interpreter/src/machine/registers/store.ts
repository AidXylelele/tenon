import { Map as PersistentMap } from "immutable";
import type { JsonValue } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import type { Activation, Address } from "./activation.js";
import { repeatedOf } from "./numbering.js";

interface StoreParts {
  readonly context: JsonValue;
  readonly next: Address;
  readonly cells: readonly (readonly [Address, Activation])[];
}

export class Store {
  static initial(context: JsonValue): Store {
    const cells = PersistentMap<Address, Activation>();

    return new Store(context, 0, cells);
  }

  static restored(parts: StoreParts): Store {
    const addresses = parts.cells.map((cell) => cell[0]);
    const beyond = addresses.find((address) => address >= parts.next);
    const repeated = repeatedOf(addresses);

    if (beyond !== undefined) {
      throw new InterpreterError(
        `The store holds a cell at ${String(beyond)}, not below its next address ${String(parts.next)}.`,
      );
    }

    if (repeated !== undefined) {
      throw new InterpreterError(
        `The store holds two cells at ${String(repeated)}.`,
      );
    }

    const cells = PersistentMap(parts.cells);
    return new Store(parts.context, parts.next, cells);
  }

  readonly #context: JsonValue;
  readonly #next: Address;
  readonly #cells: PersistentMap<Address, Activation>;

  private constructor(
    context: JsonValue,
    next: Address,
    cells: PersistentMap<Address, Activation>,
  ) {
    this.#context = context;
    this.#next = next;
    this.#cells = cells;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get next(): Address {
    return this.#next;
  }

  cellAt(address: Address): Activation {
    const cell = this.#cells.get(address);

    if (cell === undefined) {
      throw this.#noCellAt(address);
    }

    return cell;
  }

  allocated(activation: Activation): Store {
    const cells = this.#cells.set(this.#next, activation);
    const next = this.#next + 1;

    return new Store(this.#context, next, cells);
  }

  updated(address: Address, activation: Activation): Store {
    const held = this.#cells.has(address);

    if (!held) {
      throw this.#noCellAt(address);
    }

    const cells = this.#cells.set(address, activation);
    return new Store(this.#context, this.#next, cells);
  }

  freed(address: Address): Store {
    const held = this.#cells.has(address);

    if (!held) {
      throw this.#noCellAt(address);
    }

    const cells = this.#cells.delete(address);
    return new Store(this.#context, this.#next, cells);
  }

  committed(context: JsonValue): Store {
    return new Store(context, this.#next, this.#cells);
  }

  cells(): Iterable<readonly [Address, Activation]> {
    return this.#cells;
  }

  #noCellAt(address: Address): InterpreterError {
    return new InterpreterError(
      `The store holds no cell at ${String(address)}.`,
    );
  }
}
