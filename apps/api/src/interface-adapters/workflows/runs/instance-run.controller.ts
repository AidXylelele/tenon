import { Injectable } from '@nestjs/common';
import { AdvanceInstance } from '../../../application/automation/instances/advance-instance.js';
import { CompleteSubWorkflow } from '../../../application/automation/instances/complete-sub-workflow.js';
import { FaultInstance } from '../../../application/automation/instances/fault-instance.js';
import { StartSubWorkflow } from '../../../application/automation/instances/start-sub-workflow.js';
import type { SubWorkflowStepKind } from './enums.js';
import { PlatformRuntime, type RoundProgress } from './interfaces.js';
import { RoundProgressMapper } from './mappers/round-progress.mapper.js';
import { SubWorkflowStepMapper } from './mappers/sub-workflow-step.mapper.js';

@Injectable()
export class InstanceRunController {
  constructor(
    private readonly advanceInstance: AdvanceInstance,
    private readonly subWorkflowStart: StartSubWorkflow,
    private readonly subWorkflowCompletion: CompleteSubWorkflow,
    private readonly faultInstance: FaultInstance,
    private readonly runtime: PlatformRuntime,
  ) {}

  async advance(instanceId: string): Promise<RoundProgress> {
    const runtime = this.runtime.descriptor;
    const advanced = await this.advanceInstance.execute({
      instanceId,
      runtime,
    });
    return RoundProgressMapper.toRound(advanced);
  }

  async startSubWorkflow(
    instanceId: string,
    subWorkflowId: string,
  ): Promise<SubWorkflowStepKind> {
    const runtime = this.runtime.descriptor;
    const started = await this.subWorkflowStart.execute({
      instanceId,
      subWorkflowId,
      runtime,
    });
    return SubWorkflowStepMapper.toStep(started);
  }

  async completeSubWorkflow(
    instanceId: string,
    subWorkflowId: string,
  ): Promise<void> {
    const runtime = this.runtime.descriptor;
    await this.subWorkflowCompletion.execute({
      instanceId,
      subWorkflowId,
      runtime,
    });
  }

  async fault(instanceId: string): Promise<void> {
    await this.faultInstance.execute({ instanceId });
  }
}
