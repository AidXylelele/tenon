import { createHash } from 'node:crypto';
import type { JsonValue } from './interfaces.js';
import type { JsonPointer } from './json-pointer.js';

// The one owner of the work id format, by which a round finds its results again
// (architecture §3): `<task instance id>:[<stage>-<n>:]<pointer or work>`.
export class WorkKey {
  static readonly #CONTEXT = 'context';
  static readonly #DIGEST_LENGTH = 16;

  readonly #prefix: string;

  private constructor(prefix: string) {
    this.#prefix = prefix;
  }

  static of(taskInstanceId: string): WorkKey {
    return new WorkKey(`${taskInstanceId}:`);
  }

  // The work of one pass of a stage that repeats: `while-3`, `catch-1`.
  within(stage: string, count: number): WorkKey {
    const counted = String(count);
    return new WorkKey(`${this.#prefix}${stage}-${counted}:`);
  }

  // The work that reads the workflow's context, tied to the context it read: once another
  // export changed the context, its results answer the work no longer, and it runs again.
  onContext(context: JsonValue): WorkKey {
    const canonical = WorkKey.#canonical(context);
    const digest = createHash('sha256')
      .update(canonical)
      .digest('hex')
      .slice(0, WorkKey.#DIGEST_LENGTH);
    return new WorkKey(`${this.#prefix}${WorkKey.#CONTEXT}-${digest}:`);
  }

  // A template's expression or schema, by where the document declares it.
  idAt(pointer: JsonPointer): string {
    const at = pointer.toString();
    return `${this.#prefix}${at}`;
  }

  // The task's own work: `call`, `process`.
  idFor(work: string): string {
    return `${this.#prefix}${work}`;
  }

  // The task's work that repeats: `retry-2`.
  countedIdFor(work: string, count: number): string {
    const counted = String(count);
    return `${this.#prefix}${work}-${counted}`;
  }

  // Keys in order, since PostgreSQL's jsonb reorders them between rounds.
  static #canonical(value: JsonValue): string {
    if (Array.isArray(value)) {
      const items = value.map((item) => WorkKey.#canonical(item));
      return `[${items.join(',')}]`;
    }

    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);

    const names = Object.keys(value).sort();
    const members = names.map((name) => {
      const member = value[name] ?? null;
      const text = WorkKey.#canonical(member);
      return `${JSON.stringify(name)}:${text}`;
    });
    return `{${members.join(',')}}`;
  }
}
