import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { InstanceRefusal } from "../../../domain/automation/instances/enums.js";
import { Missing } from "../enums.js";
import type { InstanceResult, ReceiveInboundCommand } from "./interfaces.js";
import {
  InstanceRuns,
  ReceivedMessages,
  WorkflowInstanceRepository,
} from "./ports.js";

@Injectable()
export class ReceiveInbound {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly messages: ReceivedMessages,
    private readonly runs: InstanceRuns,
  ) {}

  @Transactional()
  async execute(command: ReceiveInboundCommand): Promise<InstanceResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const receiving = instance.receives(command.execution);

    if (!receiving) return { ok: false, failure: InstanceRefusal.NotReceiving };

    const position = await this.messages.append(
      instance,
      command.execution,
      command.inbound,
      command.fence,
    );

    if (position === null)
      return { ok: false, failure: InstanceRefusal.NotReceiving };

    await this.runs.wakeOnInbound(instance, command.execution, position);
    return { ok: true, value: undefined };
  }
}
