import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { JqOutcomeKind } from '../enums.js';
import { DefinitionWalk } from '../document/definition-walk.js';
import { Expressions } from '../document/expressions.js';
import { JsonPointer } from '../document/json-pointer.js';
import { JsonWalk } from '../document/json-walk.js';
import type { DefinitionCheck, JqClient } from '../interfaces.js';

interface FoundExpression {
  readonly pointer: string;
  readonly program: string;
}

// Every runtime expression compiles, as a compiler checks syntax: a text enclosed in `${}`
// anywhere, and a bare text in a field that only takes an expression, which the runtime
// evaluates as one. `$secrets` is bound only in the workflow's `input.from`, so that secrets
// do not leak into the data (DSL 1.0.3).
export class ExpressionCheck implements DefinitionCheck {
  static readonly #SKIPPED = new Set(['document', 'code']);
  // The fields of a task, as paths from it, whose text is always an expression.
  static readonly #TASK_FIELDS = [
    ['if'],
    ['input', 'from'],
    ['output', 'as'],
    ['export', 'as'],
    ['for', 'in'],
    ['while'],
    ['listen', 'to', 'until'],
    ['catch', 'when'],
    ['catch', 'exceptWhen'],
    ['catch', 'retry', 'when'],
    ['catch', 'retry', 'exceptWhen'],
  ];
  static readonly #WORKFLOW_FIELDS = [
    ['input', 'from'],
    ['output', 'as'],
  ];
  static readonly #SECRETS = /\$secrets\b/;
  static readonly #SECRETS_PLACE = '/input/from';

  constructor(private readonly jq: JqClient) {}

  async firstProblem(
    workflow: Specification.Workflow,
  ): Promise<CheckProblem | null> {
    for (const found of ExpressionCheck.#expressionsOf(workflow)) {
      const pointer = found.pointer;
      const program = found.program;
      const secrets = ExpressionCheck.#SECRETS.test(program);

      if (secrets && pointer !== ExpressionCheck.#SECRETS_PLACE)
        return {
          pointer,
          detail: '$secrets is available only in the workflow input.from',
        };

      const compiled = await this.jq.compile(program);

      if (compiled.kind === JqOutcomeKind.Compiled) continue;

      if (compiled.kind === JqOutcomeKind.Failure)
        return {
          pointer,
          detail: `the expression does not compile: ${compiled.failure}`,
        };

      return {
        pointer,
        detail: 'the expression cannot be compiled within its limits',
      };
    }

    return null;
  }

  static #expressionsOf(workflow: Specification.Workflow): FoundExpression[] {
    const document = workflow as unknown as JsonObject;
    const found: FoundExpression[] = [];
    const values = JsonWalk.valuesOf(document, ExpressionCheck.#SKIPPED);

    for (const located of values) {
      const text = located.value;

      if (typeof text !== 'string' || !Expressions.encloses(text)) continue;

      const pointer = located.pointer.toString();
      const program = Expressions.programOf(text);
      found.push({ pointer, program });
    }

    ExpressionCheck.#bare(
      document,
      JsonPointer.ROOT,
      ExpressionCheck.#WORKFLOW_FIELDS,
      found,
    );

    for (const located of DefinitionWalk.tasksOf(workflow)) {
      const task = located.task as unknown as JsonObject;
      ExpressionCheck.#bare(
        task,
        located.pointer,
        ExpressionCheck.#TASK_FIELDS,
        found,
      );
      ExpressionCheck.#cases(task, located.pointer, found);
    }

    return found;
  }

  // A text at one of the paths that is not enclosed: the runtime evaluates it all the same.
  static #bare(
    owner: JsonObject,
    at: JsonPointer,
    paths: readonly (readonly string[])[],
    found: FoundExpression[],
  ): void {
    for (const path of paths) {
      const value = ExpressionCheck.#valueAt(owner, path);

      if (typeof value !== 'string' || Expressions.encloses(value)) continue;

      let pointer = at;

      for (const key of path) pointer = pointer.child(key);

      found.push({ pointer: pointer.toString(), program: value });
    }
  }

  static #valueAt(
    owner: JsonObject,
    path: readonly string[],
  ): JsonValue | undefined {
    let value: JsonValue | undefined = owner;

    for (const key of path) {
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;

      value = value[key];
    }

    return value;
  }

  static #cases(
    task: JsonObject,
    at: JsonPointer,
    found: FoundExpression[],
  ): void {
    const cases = task.switch;

    if (!Array.isArray(cases)) return;

    for (const [index, item] of cases.entries()) {
      const named = Object.entries((item ?? {}) as JsonObject);

      for (const [name, body] of named) {
        const where = at.child('switch').child(index).child(name);
        const paths = [['when']];
        ExpressionCheck.#bare(body as JsonObject, where, paths, found);
      }
    }
  }
}
