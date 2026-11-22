export interface AnalysisProfile {
  readonly effects: readonly string[];
  readonly authentications: readonly string[];
  readonly processes: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly asyncApiProtocols: readonly string[];
  readonly mcpTransports: readonly string[];
  readonly mcpTransportOptions: readonly string[];
  readonly schedules: readonly string[];
  readonly triggers: string;
  readonly grants: readonly string[];
}

export interface LifecycleEventKind {
  readonly name: string;
  readonly types: readonly string[];
}

export interface ShellSupport {
  readonly platform: string;
  readonly shell: string;
  readonly commands: readonly string[];
}
