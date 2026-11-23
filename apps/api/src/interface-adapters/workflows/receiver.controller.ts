import { Injectable } from "@nestjs/common";
import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  Failure,
  JsonObject as ProtocolObject,
} from "interpreter";
import type { ReceiverView } from "../../application/automation/instances/interfaces.js";
import { ReceiverQueries } from "../../application/automation/instances/queries.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { SecretQueries } from "../../application/automation/secrets/queries.js";
import { InboundKind } from "../../domain/automation/instances/enums.js";
import type { InboundMessage } from "../../domain/automation/instances/interfaces.js";
import type { JsonOf, Receiver } from "./interfaces.js";
import { ProtocolMapper } from "./mappers/protocol.mapper.js";

@Injectable()
export class ReceiverController {
  constructor(
    private readonly receiveInbound: ReceiveInbound,
    private readonly receivers: ReceiverQueries,
    private readonly secrets: SecretQueries,
    private readonly protocol: ProtocolMapper,
  ) {}

  async openReceivers(): Promise<readonly Receiver[]> {
    const open = await this.receivers.open();
    return open.map((receiver) => this.#receiverOf(receiver));
  }

  async receive(
    instanceId: string,
    execution: string,
    message: AsyncApiInboundMessage,
    fence: number,
  ): Promise<boolean> {
    const received: InboundMessage = message;
    const inbound = { kind: InboundKind.Message as const, message: received };
    const taken = await this.receiveInbound.execute({
      instanceId,
      execution,
      inbound,
      fence,
    });
    return taken.ok;
  }

  async failReceive(
    instanceId: string,
    execution: string,
    failed: Failure,
    fence: number,
  ): Promise<boolean> {
    const failure: JsonOf<Failure> = failed;
    const inbound = { kind: InboundKind.Failure as const, failure };
    const taken = await this.receiveInbound.execute({
      instanceId,
      execution,
      inbound,
      fence,
    });
    return taken.ok;
  }

  demands(instanceId: string, execution: string): Promise<boolean> {
    return this.receivers.demands(instanceId, execution);
  }

  async secretsOf(instanceId: string): Promise<ProtocolObject> {
    const secrets = await this.secrets.ofInstance(instanceId);
    return this.protocol.toObject(secrets.values);
  }

  #receiverOf(view: ReceiverView): Receiver {
    const request = view.request as JsonOf<AsyncApiRequest>;
    const closesAt = view.closesAt?.getTime() ?? null;
    return {
      instanceId: view.instanceId,
      execution: view.execution,
      request,
      closesAt,
    };
  }
}
