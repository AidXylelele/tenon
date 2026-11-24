import type { WasmMemory } from "./types.js";

export class EngineMemory {
  readonly #memory: WasmMemory;
  readonly #snapshot: Uint8Array;

  constructor(memory: WasmMemory) {
    this.#memory = memory;
    this.#snapshot = new Uint8Array(memory.buffer).slice();
  }

  restore(): void {
    const bytes = new Uint8Array(this.#memory.buffer);

    bytes.set(this.#snapshot);
    bytes.fill(0, this.#snapshot.length);
  }
}
