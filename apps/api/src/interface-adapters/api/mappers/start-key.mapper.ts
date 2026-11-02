import { createHash } from 'node:crypto';
import type { JsonValue } from '../../../domain/automation/language/interfaces.js';
import type { WorkflowTarget } from '../../../domain/automation/language/workflow-target.js';

export class StartKeyMapper {
  static toKey(
    idempotencyKey: string | undefined,
    target: WorkflowTarget,
    input: JsonValue | undefined,
  ): string | null {
    if (idempotencyKey === undefined) return null;

    const requested = input ?? {};
    const request = { version: target.version, input: requested };
    const canonical = StartKeyMapper.#canonical(request);
    const fingerprint = createHash('sha256').update(canonical).digest('hex');
    return `${idempotencyKey}:${fingerprint}`;
  }

  static #canonical(value: JsonValue | undefined): string {
    if (value === undefined || value === null) return 'null';

    if (Array.isArray(value)) {
      const items = value.map((item) => StartKeyMapper.#canonical(item));
      return `[${items.join(',')}]`;
    }

    if (typeof value !== 'object') return JSON.stringify(value);

    // Code-unit order, as RFC 8785 sorts, so every process computes the same fingerprint.
    const names = Object.keys(value).sort();
    const members = names.map((name) => {
      const member = StartKeyMapper.#canonical(value[name]);
      return `${JSON.stringify(name)}:${member}`;
    });
    return `{${members.join(',')}}`;
  }
}
