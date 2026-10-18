import type { ParameterValue } from './parameter-value.js';
import type { ResolutionContext } from './resolution-context.js';

export class ParameterGroup implements ParameterValue {
  readonly #path: string;
  readonly #members: ReadonlyMap<string, ParameterValue>;

  constructor(path: string, members: ReadonlyMap<string, ParameterValue>) {
    this.#path = path;
    this.#members = members;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return false;
  }

  resolve(context: ResolutionContext): Record<string, unknown> {
    const resolved: [string, unknown][] = [];

    for (const [key, member] of this.#members) {
      const value = member.resolve(context);
      resolved.push([key, value]);
    }

    return Object.fromEntries(resolved);
  }

  sketch(): Record<string, unknown> {
    const sketched: [string, unknown][] = [];

    for (const [key, member] of this.#members) {
      const sketch = member.sketch();
      sketched.push([key, sketch]);
    }

    return Object.fromEntries(sketched);
  }

  leaves(): ParameterValue[] {
    const leaves: ParameterValue[] = [];

    for (const member of this.#members.values()) {
      const memberLeaves = member.leaves();
      leaves.push(...memberLeaves);
    }

    return leaves;
  }

  renameNodes(names: ReadonlyMap<string, string>): Record<string, unknown> {
    const renamed: [string, unknown][] = [];

    for (const [key, member] of this.#members) {
      const value = member.renameNodes(names);
      renamed.push([key, value]);
    }

    return Object.fromEntries(renamed);
  }
}
