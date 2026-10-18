import type { Node } from './node.js';

export class Connection {
  readonly #from: Node;
  readonly #output: string;
  readonly #to: Node;
  readonly #input: string;

  constructor(from: Node, output: string, to: Node, input: string) {
    this.#from = from;
    this.#output = output;
    this.#to = to;
    this.#input = input;
  }

  get from(): Node {
    return this.#from;
  }

  get output(): string {
    return this.#output;
  }

  get to(): Node {
    return this.#to;
  }

  get input(): string {
    return this.#input;
  }
}
