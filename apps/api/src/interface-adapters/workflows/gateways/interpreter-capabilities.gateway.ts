import { Injectable } from "@nestjs/common";
import type {
  AnalysisProfile,
  LifecycleEventKind,
} from "../../../application/automation/host/interfaces.js";
import type { HostCapabilities } from "../../../application/automation/host/queries.js";
import { InterpreterClient } from "../interfaces.js";

@Injectable()
export class InterpreterCapabilitiesGateway implements HostCapabilities {
  constructor(private readonly client: InterpreterClient) {}

  profile(): AnalysisProfile {
    const profile = this.client.profile([]);
    return {
      effects: profile.effects,
      authentications: profile.authentications,
      processes: profile.processes,
      scriptLanguages: profile.scriptLanguages,
      asyncApiProtocols: profile.asyncApiProtocols,
      mcpTransports: profile.mcpTransports,
      mcpTransportOptions: profile.mcpTransportOptions,
      schedules: profile.schedules,
      triggers: profile.triggers,
      grants: profile.grants,
    };
  }

  lifecycleEvents(): readonly LifecycleEventKind[] {
    const eventTypes = this.client.lifecycleEventTypes();
    const entries = Object.entries(eventTypes);
    return entries.map(([name, types]) => ({ name, types }));
  }
}
