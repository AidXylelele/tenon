import type {
  AnalysisProfile,
  LifecycleEventKind,
  ShellSupport,
} from "./interfaces.js";

export abstract class HostCapabilities {
  abstract profile(): AnalysisProfile;
  abstract lifecycleEvents(): readonly LifecycleEventKind[];
}

export class ProcessPlatform {
  constructor(readonly shell: ShellSupport) {}
}

export class HostLimits {
  constructor(
    readonly callSeconds: number,
    readonly processSeconds: number,
    readonly responseBytes: number,
  ) {}
}
