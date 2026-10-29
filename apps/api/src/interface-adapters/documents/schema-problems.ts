import type { ErrorObject } from 'ajv';
import { Problem } from '../../domain/automation/language/problem.js';

const SUMMARIES = new Set(['oneOf', 'anyOf', 'if', 'not', '$ref']);

const TASK_KINDS = [
  'call',
  'do',
  'emit',
  'for',
  'fork',
  'listen',
  'raise',
  'run',
  'set',
  'switch',
  'try',
  'wait',
];

const COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  call: ['with'],
  for: ['do', 'while'],
  try: ['catch'],
};

const BRANCH = /^#\/oneOf\/(\d+)\//;

export class SchemaProblems {
  readonly #document: unknown;
  readonly #errors: readonly ErrorObject[];

  constructor(document: unknown, errors: readonly ErrorObject[]) {
    this.#document = document;
    this.#errors = errors;
  }

  located(): Problem[] {
    const discarded = this.#mismatchedBranches();
    const problems = new Map<string, Problem>();

    for (const error of this.#errors) {
      const reason = this.#reasonOf(error, discarded);

      if (reason === null) continue;

      const pointer = error.instancePath;
      problems.set(`${pointer} ${reason}`, new Problem(pointer, reason));
    }

    return Array.from(problems.values());
  }

  #mismatchedBranches(): ReadonlySet<string> {
    const discarded = new Set<string>();

    for (const error of this.#errors) {
      const branch = BRANCH.exec(error.schemaPath);

      if (error.keyword !== 'const' || branch === null) continue;

      const parent = error.instancePath.replace(/\/[^/]*$/, '');
      discarded.add(`${parent} ${branch[1] ?? ''}`);
    }

    return discarded;
  }

  #reasonOf(error: ErrorObject, discarded: ReadonlySet<string>): string | null {
    if (SUMMARIES.has(error.keyword) || error.keyword === 'const') return null;

    const branch = BRANCH.exec(error.schemaPath);
    const inBranch =
      branch !== null &&
      this.#isDiscarded(error.instancePath, branch[1] ?? '', discarded);

    if (inBranch) return null;

    const kinds = this.#taskKindsAt(error.instancePath);

    if (kinds === null) return this.#describe(error);

    return this.#describeForTask(error, kinds);
  }

  #isDiscarded(
    pointer: string,
    branch: string,
    discarded: ReadonlySet<string>,
  ): boolean {
    for (const entry of discarded) {
      const [parent = '', index] = entry.split(' ');

      if (
        index === branch &&
        (pointer === parent || pointer.startsWith(`${parent}/`))
      )
        return true;
    }

    return false;
  }

  #describeForTask(
    error: ErrorObject,
    kinds: readonly string[],
  ): string | null {
    const kind = kinds[0];
    const companions = kind === undefined ? [] : (COMPANIONS[kind] ?? []);
    const missing =
      error.keyword === 'required'
        ? String(error.params.missingProperty)
        : null;
    const unevaluated =
      error.keyword === 'unevaluatedProperties'
        ? String(error.params.unevaluatedProperty)
        : null;

    if (kind === undefined && missing !== null)
      return `must define one task: ${TASK_KINDS.join(', ')}`;

    if (missing !== null && !companions.includes(missing)) return null;

    if (
      unevaluated !== null &&
      (unevaluated === kind || companions.includes(unevaluated))
    )
      return null;

    return this.#describe(error);
  }

  #describe(error: ErrorObject): string {
    const message = error.message ?? error.keyword;

    if (error.keyword === 'unevaluatedProperties')
      return `${message}: ${String(error.params.unevaluatedProperty)}`;

    if (error.keyword === 'additionalProperties')
      return `${message}: ${String(error.params.additionalProperty)}`;

    if (error.keyword === 'enum')
      return `${message}: ${JSON.stringify(error.params.allowedValues)}`;

    return message;
  }

  #taskKindsAt(pointer: string): readonly string[] | null {
    const value = this.#valueAt(pointer);
    const isTaskSlot =
      /\/(do|try|branches|functions)\/\d+\/[^/]+$|\/functions\/[^/]+$/.test(
        pointer,
      );

    if (
      !isTaskSlot ||
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    )
      return null;

    const keys = Object.keys(value);
    return TASK_KINDS.filter((kind) => keys.includes(kind));
  }

  #valueAt(pointer: string): unknown {
    const segments = pointer.split('/').slice(1);
    let current: unknown = this.#document;

    for (const segment of segments) {
      const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');

      if (typeof current !== 'object' || current === null) return undefined;

      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }
}
