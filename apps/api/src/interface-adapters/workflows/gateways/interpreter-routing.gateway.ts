import { Injectable } from "@nestjs/common";
import type { AcceptedEvent } from "../../../application/automation/events/interfaces.js";
import type { EventRouting } from "../../../application/automation/events/ports.js";
import type {
  ProgramReference,
  RoutingMatch,
} from "../../../domain/automation/instances/interfaces.js";
import { InterpreterClient } from "../interfaces.js";
import { ProtocolMapper } from "../mappers/protocol.mapper.js";
import { ProgramCalls } from "../program-calls.js";

@Injectable()
export class InterpreterRoutingGateway implements EventRouting {
  constructor(
    private readonly client: InterpreterClient,
    private readonly calls: ProgramCalls,
    private readonly protocol: ProtocolMapper,
  ) {}

  async accepting(
    programs: readonly ProgramReference[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<readonly RoutingMatch[]> {
    const offered = this.protocol.toCloudEvent(event.cloudEvent);
    const matches: RoutingMatch[] = [];

    for (const program of programs) {
      const call = this.calls.of(program.versionId, null, signal);
      const routed = await this.client.route(call, offered);

      for (const route of routed)
        matches.push({
          versionId: program.versionId,
          stream: route.stream,
          level: route.level,
          filter: route.filter,
        });
    }

    return matches;
  }
}
