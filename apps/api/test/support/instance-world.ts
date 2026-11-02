import { WorkAnswers } from '../../src/application/automation/instances/work-answers.js';
import { AdvanceInstance } from '../../src/application/automation/instances/advance-instance.js';
import { BeginRound } from '../../src/application/automation/instances/begin-round.js';
import { CompleteSubWorkflow } from '../../src/application/automation/instances/complete-sub-workflow.js';
import { FaultInstance } from '../../src/application/automation/instances/fault-instance.js';
import { RecordRound } from '../../src/application/automation/instances/record-round.js';
import { RunDetachedProcess } from '../../src/application/automation/instances/run-detached-process.js';
import { StartDetachedWorkflow } from '../../src/application/automation/instances/start-detached-workflow.js';
import { StartInstance } from '../../src/application/automation/instances/start-instance.js';
import { StartSubWorkflow } from '../../src/application/automation/instances/start-sub-workflow.js';
import { CheckDocument } from '../../src/application/automation/workflows/check-document.js';
import { PublishVersion } from '../../src/application/automation/workflows/publish-version.js';
import { ReadVersionDefinition } from '../../src/application/automation/workflows/read-version-definition.js';
import type { JsonValue } from '../../src/domain/automation/language/interfaces.js';
import type {
  ProcessRun,
  ServiceCall,
} from '../../src/domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../src/domain/automation/language/results/process-result.js';
import type { ServiceResult } from '../../src/domain/automation/language/results/service-result.js';
import { DocumentFormat } from '../../src/domain/automation/workflows/enums.js';
import {
  FakeExpressionEvaluator,
  InMemoryWorkflowRepository,
  InMemoryWorkflowVersionRepository,
  JsonDefinitionReader,
} from './fakes.js';
import {
  AcceptingSchemaValidator,
  FixedClock,
  InMemoryInstanceQueries,
  InMemoryWorkflowInstanceRepository,
  InMemoryWorkflowQueries,
  RecordingEventRepository,
  RecordingInstanceRuns,
  ScriptedProcessRunner,
  ScriptedServiceCaller,
} from './instance-fakes.js';

export const runtime = { name: 'tenon', version: '1.0.0' };

export function documentOf(
  name: string,
  version: string,
  body: JsonValue,
): string {
  const qualified = name.includes('/') ? name : `default/${name}`;
  const [namespace = 'default', workflow = name] = qualified.split('/');
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace, name: workflow, version },
    do: body,
  });
}

export function instanceWorld(
  respond: (call: ServiceCall) => ServiceResult | null = () => null,
  exit: (run: ProcessRun) => ProcessResult | null = () => null,
  delay: (call: ServiceCall) => number = () => 0,
) {
  const clock = new FixedClock(new Date('2026-11-01T10:00:00.000Z'));
  const workflows = new InMemoryWorkflowRepository();
  const versions = new InMemoryWorkflowVersionRepository(workflows);
  const reader = new JsonDefinitionReader();
  const expressions = new FakeExpressionEvaluator();
  const schemas = new AcceptingSchemaValidator();
  const publish = new PublishVersion(
    new CheckDocument(reader, expressions, schemas, versions),
    workflows,
    versions,
    clock,
  );
  const instances = new InMemoryWorkflowInstanceRepository();
  const runs = new RecordingInstanceRuns();
  const events = new RecordingEventRepository();
  const services = new ScriptedServiceCaller(respond, delay);
  const processes = new ScriptedProcessRunner(exit);
  const workflowQueries = new InMemoryWorkflowQueries(versions);
  const instanceQueries = new InMemoryInstanceQueries(instances);
  const readDefinition = new ReadVersionDefinition(workflowQueries, reader);
  const beginRound = new BeginRound(instances, readDefinition, events);
  const recordRound = new RecordRound(instances, events);
  return {
    clock,
    workflows,
    versions,
    instances,
    instanceQueries,
    runs,
    events,
    services,
    processes,
    publish: (text: string) =>
      publish.execute({
        format: DocumentFormat.Json,
        text,
        publisherId: 'author-1',
      }),
    start: new StartInstance(workflows, versions, instances, runs, clock),
    advance: new AdvanceInstance(
      beginRound,
      recordRound,
      new WorkAnswers(expressions, schemas, services, processes),
      clock,
    ),
    fault: new FaultInstance(instances, events, clock),
    startSubWorkflow: new StartSubWorkflow(
      instances,
      instanceQueries,
      workflows,
      versions,
      readDefinition,
      events,
      clock,
    ),
    completeSubWorkflow: new CompleteSubWorkflow(
      instances,
      instanceQueries,
      readDefinition,
      events,
      clock,
    ),
    startDetached: new StartDetachedWorkflow(
      instances,
      instanceQueries,
      workflows,
      versions,
      runs,
      clock,
    ),
    runDetached: new RunDetachedProcess(processes),
  };
}
