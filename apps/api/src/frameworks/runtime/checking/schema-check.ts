import type { ErrorObject, ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { workflowSchema } from '@openworkflowspec/sdk';
import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { TaskKind } from '../enums.js';
import { TaskKinds } from '../document/task-kind.js';

interface LocatedTaskValue {
  readonly pointer: string;
  readonly task: Specification.Task;
}

// The document against the standard's own JSON Schema (DSL 1.0.3, exported by the SDK). A task
// matches one of several kinds, so Ajv reports every kind's complaint at a defective task: the
// task is validated again against the kind it declares, which names the real defect.
export class SchemaCheck {
  static readonly #BRANCHES = new Set(['oneOf', 'anyOf', 'const', 'not', 'if']);
  static readonly #UNKNOWN = new Set([
    'unevaluatedProperties',
    'additionalProperties',
  ]);
  static readonly #LISTS = new Set(['do', 'try', 'branches']);
  static readonly #CALLS = [
    'asyncapi',
    'grpc',
    'http',
    'openapi',
    'a2a',
    'mcp',
  ];
  static readonly #FUNCTION_CALL = 'function';
  static readonly #NO_KIND =
    'the task declares no kind: call, do, emit, for, fork, listen, raise, run, set, switch, try or wait';

  readonly #document: ValidateFunction;
  readonly #kinds = new Map<string, ValidateFunction>();

  constructor() {
    const ajv = new Ajv2020({ strict: false });
    ajvFormats.default(ajv);
    const schema = workflowSchema as JsonObject;
    const id = schema.$id as string;
    ajv.addSchema(schema);
    this.#document = ajv.compile({ $ref: id });

    for (const kind of Object.values(TaskKind)) {
      const ref = `${id}#/$defs/${kind}Task`;
      const validate = ajv.compile({ $ref: ref });
      this.#kinds.set(kind, validate);
    }

    const definitions = schema.$defs as Record<string, JsonObject>;
    const calls = (definitions.callTask?.oneOf ?? []) as readonly JsonObject[];

    for (const [index, variant] of calls.entries()) {
      const key = SchemaCheck.#callOf(variant);
      const ref = `${id}#/$defs/callTask/oneOf/${String(index)}`;
      const validate = ajv.compile({ $ref: ref });
      this.#kinds.set(key, validate);
    }
  }

  problemOf(document: JsonObject): CheckProblem | null {
    const valid = this.#document(document);

    if (valid) return null;

    const errors = this.#document.errors ?? [];
    const deepest = SchemaCheck.#mostSpecific(errors);
    const enclosing = SchemaCheck.#taskAround(deepest.instancePath, document);

    if (enclosing === null) return SchemaCheck.#problemOf(deepest, '');

    const refined = this.#refined(enclosing);
    return refined ?? SchemaCheck.#problemOf(deepest, '');
  }

  #refined(located: LocatedTaskValue): CheckProblem | null {
    const kind = TaskKinds.of(located.task);

    if (kind === null)
      return { pointer: located.pointer, detail: SchemaCheck.#NO_KIND };

    const key = SchemaCheck.#keyOf(kind, located.task);
    const validate = this.#kinds.get(key);

    if (validate === undefined) return null;

    const valid = validate(located.task);

    if (valid) return null;

    const errors = validate.errors ?? [];
    const specific = SchemaCheck.#mostSpecific(errors);
    return SchemaCheck.#problemOf(specific, located.pointer);
  }

  static #keyOf(kind: TaskKind, task: Specification.Task): string {
    if (kind !== TaskKind.Call) return kind;

    const call = (task as Specification.CallTask).call;
    const known = typeof call === 'string' && SchemaCheck.#CALLS.includes(call);

    if (known) return `call:${call}`;

    return `call:${SchemaCheck.#FUNCTION_CALL}`;
  }

  static #callOf(variant: JsonObject): string {
    const parts = variant.allOf as readonly JsonObject[];

    for (const part of parts) {
      const properties = part.properties as JsonObject | undefined;
      const call = properties?.call as JsonObject | undefined;
      const constant = call?.const;

      if (typeof constant === 'string') return `call:${constant}`;
    }

    return `call:${SchemaCheck.#FUNCTION_CALL}`;
  }

  // The deepest complaint that is not only a choice between branches; at the same depth an
  // unknown property names the defect best, a missing one least.
  static #mostSpecific(errors: readonly ErrorObject[]): ErrorObject {
    const located = errors.filter(
      (error) => !SchemaCheck.#BRANCHES.has(error.keyword),
    );
    const candidates = located.length > 0 ? located : errors;
    const ranked = candidates.toSorted(
      (left, right) => SchemaCheck.#rankOf(left) - SchemaCheck.#rankOf(right),
    );
    const [first] = ranked;

    if (first === undefined) throw new TypeError('Ajv reported no error');

    return first;
  }

  static #rankOf(error: ErrorObject): number {
    const depth = error.instancePath.split('/').length;
    const precision = SchemaCheck.#precisionOf(error);
    return precision - depth * 10;
  }

  static #precisionOf(error: ErrorObject): number {
    if (SchemaCheck.#UNKNOWN.has(error.keyword)) return 0;

    if (error.keyword === 'required') return 2;

    return 1;
  }

  static #problemOf(error: ErrorObject, prefix: string): CheckProblem {
    const at = `${prefix}${error.instancePath}`;
    const params = error.params as Record<string, unknown>;
    const unknownProperty =
      params.unevaluatedProperty ?? params.additionalProperty;

    if (typeof unknownProperty === 'string') {
      const escaped = SchemaCheck.#escaped(unknownProperty);
      const pointer = `${at}/${escaped}`;
      return { pointer, detail: `'${unknownProperty}' is not a property here` };
    }

    const missingProperty = params.missingProperty;

    if (typeof missingProperty === 'string')
      return { pointer: at, detail: `missing property '${missingProperty}'` };

    const detail = error.message ?? error.keyword;
    return { pointer: at, detail };
  }

  // The innermost task around a pointer: the name after an index into a task list, or a
  // function declared in `use.functions`.
  static #taskAround(
    pointer: string,
    document: JsonObject,
  ): LocatedTaskValue | null {
    const tokens = pointer.split('/').slice(1);

    for (let end = tokens.length; end >= 3; end -= 1) {
      const list = tokens[end - 3] ?? '';
      const index = tokens[end - 2] ?? '';
      const listed = SchemaCheck.#LISTS.has(list) && /^\d+$/.test(index);
      const declared =
        end === 3 && tokens[0] === 'use' && tokens[1] === 'functions';

      if (!listed && !declared) continue;

      const taskTokens = tokens.slice(0, end);
      const task = SchemaCheck.#valueAt(document, taskTokens);

      if (task === null || typeof task !== 'object' || Array.isArray(task))
        continue;

      const taskPointer = `/${taskTokens.join('/')}`;
      return { pointer: taskPointer, task: task as Specification.Task };
    }

    return null;
  }

  static #valueAt(document: JsonObject, tokens: readonly string[]): JsonValue {
    let value: JsonValue = document;

    for (const token of tokens) {
      const key = token.replaceAll('~1', '/').replaceAll('~0', '~');

      if (value === null || typeof value !== 'object') return null;

      const next: JsonValue | undefined = Array.isArray(value)
        ? value[Number(key)]
        : value[key];
      value = next ?? null;
    }

    return value;
  }

  static #escaped(token: string): string {
    return token.replaceAll('~', '~0').replaceAll('/', '~1');
  }
}
