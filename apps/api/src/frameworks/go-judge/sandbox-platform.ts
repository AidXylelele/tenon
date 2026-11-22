import type { ShellSupport } from "../../application/automation/host/interfaces.js";
import type { ProcessPlatform } from "../../application/automation/host/queries.js";
import shellPlatform from "./shell-platform.json" with { type: "json" };

export class SandboxPlatform implements ProcessPlatform {
  shell(): ShellSupport {
    return shellPlatform;
  }
}
