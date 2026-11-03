import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { TriggerKind } from '../../../domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { JsonValue } from '../../../domain/automation/json.js';
import type { StartRefusal } from '../../../domain/automation/workflows/interfaces.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { Result } from '../../../domain/result.js';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import { WorkflowInstanceRepository } from './ports.js';

export interface StartSubWorkflowCommand {
  readonly parentId: string;
  readonly name: WorkflowName;
  // The version named, or null for the current one.
  readonly version: string | null;
  readonly input: JsonValue;
  // Parent when the task awaits the child, Detached when it does not.
  readonly trigger: TriggerKind;
}

// A `run: workflow` task's child: an instance of the version named, of a workflow that is not
// archived. The parent's run starts the child's run.
@Injectable()
export class StartSubWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(
    command: StartSubWorkflowCommand,
  ): Promise<Result<WorkflowInstance, StartRefusal | Missing>> {
    const now = this.clock.now();
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = await this.versions.findToRun(
      command.name,
      command.version,
    );

    if (version === null) return { ok: false, failure: Missing.Version };

    const started = workflow.startInstance({
      version,
      input: command.input,
      trigger: command.trigger,
      starterId: null,
      originId: command.parentId,
      now,
    });

    if (!started.ok) return started;

    await this.instances.save(started.value);
    return started;
  }
}
