import { Injectable } from '@nestjs/common';
import { AcceptEvent } from '../../../application/automation/events/accept-event.js';
import { EventOrigin } from '../../../application/automation/events/enums.js';
import { SecretQueries } from '../../../application/automation/secrets/queries.js';
import { Listen } from '../../../application/automation/events/listen.js';
import { Unlisten } from '../../../application/automation/events/unlisten.js';
import { BeginInstance } from '../../../application/automation/instances/begin-instance.js';
import { BeginWaiting } from '../../../application/automation/instances/begin-waiting.js';
import { CompleteInstance } from '../../../application/automation/instances/complete-instance.js';
import { EndWaiting } from '../../../application/automation/instances/end-waiting.js';
import { TaskStatus } from '../../../application/automation/instances/enums.js';
import { FaultInstance } from '../../../application/automation/instances/fault-instance.js';
import { InstanceDirective } from '../../../application/automation/instances/instance-directive.js';
import { InstanceQueries } from '../../../application/automation/instances/queries.js';
import { RecordTaskEnd } from '../../../application/automation/instances/record-task-end.js';
import { RecordTaskStart } from '../../../application/automation/instances/record-task-start.js';
import {
  type RunDirective,
  TriggerKind,
} from '../../../domain/automation/instances/enums.js';
import { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import { StartSubWorkflow } from '../../../application/automation/instances/start-sub-workflow.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import {
  type ChildOutcome,
  type ChildRequest,
  type ChildStart,
  RunObserver,
  type RunPlan,
  type TaskEnded,
  type TaskStarted,
} from '../interfaces.js';

// The runtime's calls into the platform, mapped to the use cases that keep the instance and its
// progress.
@Injectable()
export class InstanceRunController extends RunObserver {
  constructor(
    private readonly instances: InstanceQueries,
    private readonly beginInstance: BeginInstance,
    private readonly recordTaskStart: RecordTaskStart,
    private readonly recordTaskEnd: RecordTaskEnd,
    private readonly beginWaiting: BeginWaiting,
    private readonly endWaiting: EndWaiting,
    private readonly instanceDirective: InstanceDirective,
    private readonly completeInstance: CompleteInstance,
    private readonly faultInstance: FaultInstance,
    private readonly startSubWorkflow: StartSubWorkflow,
    private readonly acceptEvent: AcceptEvent,
    private readonly listenUseCase: Listen,
    private readonly secretQueries: SecretQueries,
    private readonly unlistenUseCase: Unlisten,
  ) {
    super();
  }

  begin(instanceId: string): Promise<RunDirective> {
    return this.beginInstance.execute({ instanceId });
  }

  // The instance's run plan, or null when the instance is gone.
  async plan(instanceId: string): Promise<RunPlan | null> {
    const plan = await this.instances.plan(instanceId);

    if (plan === null) return null;

    return {
      instanceId: plan.instanceId,
      namespace: plan.namespace,
      name: plan.name,
      version: plan.version,
      document: plan.document,
      input: plan.input,
      startedAt: plan.startedAt.toISOString(),
    };
  }

  async taskStarted(instanceId: string, task: TaskStarted): Promise<void> {
    const at = new Date(task.at);
    await this.recordTaskStart.execute({
      instanceId,
      task: {
        execution: task.execution,
        reference: task.reference,
        name: task.name,
        status: TaskStatus.Running,
        input: task.input,
        output: null,
        error: null,
        attempt: task.attempt,
        retryAt: null,
        at,
      },
    });
  }

  taskEnded(instanceId: string, task: TaskEnded): Promise<RunDirective> {
    const at = new Date(task.at);
    const retryAt = task.retryAt === null ? null : new Date(task.retryAt);
    return this.recordTaskEnd.execute({
      instanceId,
      task: {
        execution: task.execution,
        reference: task.reference,
        name: task.name,
        status: task.status,
        input: null,
        output: task.output,
        error: task.error,
        attempt: task.attempt,
        retryAt,
        at,
      },
    });
  }

  waiting(instanceId: string): Promise<void> {
    return this.beginWaiting.execute({ instanceId });
  }

  running(instanceId: string): Promise<void> {
    return this.endWaiting.execute({ instanceId });
  }

  directive(instanceId: string): Promise<RunDirective> {
    return this.instanceDirective.execute({ instanceId });
  }

  async startChild(parentId: string, child: ChildRequest): Promise<ChildStart> {
    const name = new WorkflowName(child.namespace, child.name);
    const trigger = child.detached ? TriggerKind.Detached : TriggerKind.Parent;
    const started = await this.startSubWorkflow.execute({
      parentId,
      name,
      version: child.version,
      input: child.input,
      trigger,
    });

    if (!started.ok)
      return {
        childId: null,
        refusal: `The sub-workflow cannot start: ${started.failure}`,
      };

    return { childId: started.value.id, refusal: null };
  }

  async outcomeOf(childId: string): Promise<ChildOutcome> {
    const child = await this.instances.get(childId);

    if (child === null) return { phase: null, output: null, error: null };

    return { phase: child.phase, output: child.output, error: child.error };
  }

  secrets(
    instanceId: string,
    names: readonly string[],
  ): Promise<Record<string, string>> {
    return this.secretQueries.valuesFor(instanceId, names);
  }

  listen(
    instanceId: string,
    key: string,
    types: string[] | null,
  ): Promise<void> {
    return this.listenUseCase.execute({ instanceId, key, types });
  }

  unlisten(instanceId: string, key: string): Promise<void> {
    return this.unlistenUseCase.execute({ instanceId, key });
  }

  async emitted(instanceId: string, event: JsonObject): Promise<void> {
    await this.acceptEvent.execute({
      cloudEvent: event,
      origin: EventOrigin.Emit,
      instanceId,
    });
  }

  completed(instanceId: string, output: JsonValue): Promise<void> {
    return this.completeInstance.execute({ instanceId, output, error: null });
  }

  faulted(instanceId: string, error: JsonObject): Promise<void> {
    return this.faultInstance.execute({ instanceId, output: null, error });
  }
}
