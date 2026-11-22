import { Injectable } from "@nestjs/common";
import type {
  AnalysisProfile,
  LifecycleEventKind,
  ShellSupport,
} from "../../../application/automation/host/interfaces.js";
import type { HostLimits } from "../../../application/automation/host/queries.js";
import type { HostProfileResponse } from "../schemas/host.schemas.js";

@Injectable()
export class HostPresenter {
  profile(
    analysis: AnalysisProfile,
    shell: ShellSupport,
    limits: HostLimits,
    events: readonly LifecycleEventKind[],
  ): HostProfileResponse {
    const lifecycleEvents = events.map((event) => ({
      name: event.name,
      types: event.types.slice(),
    }));
    return {
      effects: analysis.effects.slice(),
      authentications: analysis.authentications.slice(),
      processes: analysis.processes.slice(),
      scriptLanguages: analysis.scriptLanguages.slice(),
      asyncApiProtocols: analysis.asyncApiProtocols.slice(),
      mcpTransports: analysis.mcpTransports.slice(),
      mcpTransportOptions: analysis.mcpTransportOptions.slice(),
      schedules: analysis.schedules.slice(),
      triggers: analysis.triggers,
      grants: analysis.grants.slice(),
      shell: {
        platform: shell.platform,
        shell: shell.shell,
        commands: shell.commands.slice(),
      },
      limits: {
        callSeconds: limits.callSeconds,
        processSeconds: limits.processSeconds,
        responseBytes: limits.responseBytes,
      },
      lifecycleEvents,
    };
  }
}
