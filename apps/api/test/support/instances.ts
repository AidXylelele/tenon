import type { Definition } from '../../src/domain/automation/language/definition.js';
import type {
  JsonObject,
  JsonValue,
} from '../../src/domain/automation/language/interfaces.js';
import type { Origin } from '../../src/domain/automation/instances/interfaces.js';
import { UserOrigin } from '../../src/domain/automation/instances/origins/user-origin.js';
import { RoundContext } from '../../src/domain/automation/instances/round-context.js';
import { WorkflowInstance } from '../../src/domain/automation/instances/workflow-instance.js';
import { DocumentFormat } from '../../src/domain/automation/workflows/enums.js';
import { RunnableVersion } from '../../src/domain/automation/workflows/runnable-version.js';
import { SourceDocument } from '../../src/domain/automation/workflows/source-document.js';
import { Workflow } from '../../src/domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../src/domain/automation/workflows/workflow-version.js';
import { answer, now } from './progress.js';

export const runtime: JsonObject = { name: 'tenon', version: '1.0.0' };

type Answers = Parameters<typeof answer>[1];

export interface Published {
  readonly workflow: Workflow;
  readonly version: WorkflowVersion;
}

export function published(definition: Definition): Published {
  const workflow = Workflow.register(definition.workflow);
  const source = new SourceDocument({
    format: DocumentFormat.Json,
    text: '{}',
  });
  const version = workflow.publish({
    definition,
    source,
    publisherId: 'user-1',
    now,
  });
  return { workflow, version };
}

export function roundAt(definition: Definition, at: Date = now): RoundContext {
  return new RoundContext({ definition, runtime, now: at });
}

export function started(
  definition: Definition,
  input: JsonValue | undefined = {},
  id = 'a6a2c7b4-6f0e-4d39-9a4b-6f1b8f4b0001',
  origin: Origin = new UserOrigin('user-1'),
): WorkflowInstance {
  const { workflow, version } = published(definition);
  const runnable = new RunnableVersion({ workflow, version });
  return WorkflowInstance.start({
    id,
    runnable,
    input,
    origin,
    now,
  });
}

export function settle(
  instance: WorkflowInstance,
  definition: Definition,
  at: Date = now,
  answers: Answers = {},
): void {
  for (let round = 0; round < 50; round += 1) {
    const work = instance.pendingWork(roundAt(definition, at));
    const outside = work.calls.length + work.processes.length > 0;

    if (work.isEmpty() || (outside && !answers.respond && !answers.exit))
      return;

    const results = answer(work, answers);
    instance.record(results, roundAt(definition, at));
  }

  throw new Error('The instance did not settle');
}

export function typesOf(instance: WorkflowInstance): readonly string[] {
  const produced = instance.takeProducedEvents();
  return produced.map((event) =>
    event.type.replace('io.serverlessworkflow.', '').replace('.v1', ''),
  );
}
