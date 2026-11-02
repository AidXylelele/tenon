import type { Definition } from '../../src/domain/automation/language/definition.js';
import type {
  Evaluation,
  JsonObject,
  JsonValue,
} from '../../src/domain/automation/language/interfaces.js';
import { JsonPointer } from '../../src/domain/automation/language/json-pointer.js';
import { Outcome } from '../../src/domain/automation/language/outcome.js';
import { TaskEnding } from '../../src/domain/automation/language/task-ending.js';
import { TaskScope } from '../../src/domain/automation/language/scopes/task-scope.js';
import { Evaluated } from '../../src/domain/automation/language/results/evaluated.js';
import type { EvaluationResult } from '../../src/domain/automation/language/results/evaluation-result.js';
import type { ProcessResult } from '../../src/domain/automation/language/results/process-result.js';
import { RoundResults } from '../../src/domain/automation/language/round-results.js';
import type { ServiceResult } from '../../src/domain/automation/language/results/service-result.js';
import { Validated } from '../../src/domain/automation/language/results/validated.js';
import type { ValidationResult } from '../../src/domain/automation/language/results/validation-result.js';
import type { RoundWork } from '../../src/domain/automation/language/round-work.js';
import type * as Dsl from '../../src/interface-adapters/workflows/definitions/interfaces.js';
import { DefinitionMapper } from '../../src/interface-adapters/workflows/definitions/mappers/definition.mapper.js';

export const now = new Date('2026-10-31T10:00:00.000Z');

export function definitionOf(
  body: JsonValue,
  use: JsonObject = {},
  input: JsonObject | null = null,
  name = 'default/test',
): Definition {
  const [namespace = 'default', named = 'test'] = name.split('/');
  const top: Record<string, JsonValue> = {
    document: {
      dsl: '1.0.3',
      namespace,
      name: named,
      version: '1.0.0',
    },
    use,
    do: body,
  };

  if (input !== null) top.input = input;

  const document: JsonObject = top;
  const workflow = document as unknown as Dsl.Workflow;
  return DefinitionMapper.toDomain(workflow, document);
}

export function pointerOf(text: string): JsonPointer {
  const tokens = text.split('/').slice(1);
  return new JsonPointer(tokens);
}

interface ScopeOptions {
  readonly id?: string;
  readonly variables?: JsonObject;
  readonly context?: JsonValue;
  readonly at?: Date;
}

export function scopeOf(
  definition: Definition,
  reference: string,
  rawInput: JsonValue,
  options: ScopeOptions = {},
): TaskScope {
  const pointer = pointerOf(reference);
  return new TaskScope({
    id: options.id ?? 'task-1',
    task: definition.taskAt(pointer),
    definition,
    rawInput,
    context: options.context ?? {},
    instanceId: 'instance-1',
    workflowInput: {},
    workflowStartedAt: now,
    runtime: { name: 'tenon', version: '1.0.0' },
    variables: options.variables ?? {},
    startedAt: now,
    deadline: null,
    now: options.at ?? now,
  });
}

interface Answers {
  readonly evaluate?: (evaluation: Evaluation) => EvaluationResult;
  readonly validate?: (id: string) => ValidationResult;
  readonly respond?: (id: string) => ServiceResult;
  readonly exit?: (id: string) => ProcessResult;
}

export function evaluatedAs(
  value: (evaluation: Evaluation) => JsonValue,
): (evaluation: Evaluation) => EvaluationResult {
  return (evaluation) => new Evaluated(evaluation.id, value(evaluation));
}

export function answer(work: RoundWork, answers: Answers): RoundResults {
  const evaluate =
    answers.evaluate ?? evaluatedAs((evaluation) => evaluation.data);
  const validate = answers.validate ?? ((id: string) => new Validated(id));
  const evaluated = work.evaluations.map((evaluation) => evaluate(evaluation));
  const validated = work.validations.map((validation) =>
    validate(validation.id),
  );
  const responses: ServiceResult[] = [];
  const processes: ProcessResult[] = [];

  for (const call of work.calls)
    if (answers.respond) responses.push(answers.respond(call.id));

  for (const run of work.processes)
    if (answers.exit) processes.push(answers.exit(run.id));

  return new RoundResults({ evaluated, validated, responses, processes });
}

export function completedAt(
  definition: Definition,
  reference: string,
  output: JsonValue,
): TaskEnding {
  const pointer = pointerOf(reference);
  const then = definition.taskAt(pointer).base.then;
  const outcome = Outcome.of(output);
  return TaskEnding.completed({
    output,
    then,
    exported: false,
    context: null,
    outcome,
  });
}
