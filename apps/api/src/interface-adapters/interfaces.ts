import type {
  RunKind,
  ScriptLanguage,
} from '../domain/automation/language/enums.js';
import type { JsonValue } from '../domain/automation/language/interfaces.js';
export interface ProcessDetachedPayload {
  readonly instanceId: string;
  readonly taskInstanceId: string;
  readonly run: {
    readonly id: string;
    readonly kind: RunKind;
    readonly language: ScriptLanguage | null;
    readonly process: JsonValue;
  };
}

export interface WorkflowDetachedPayload {
  readonly instanceId: string;
  readonly taskInstanceId: string;
  readonly subWorkflowId: string;
  readonly detached: {
    readonly namespace: string;
    readonly name: string;
    readonly versionId: string;
    readonly input: JsonValue;
  };
}
