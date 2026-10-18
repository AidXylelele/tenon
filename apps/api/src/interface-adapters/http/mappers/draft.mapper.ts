import type {
  DraftGraph,
  DraftNode,
  DraftNodeSettings,
} from '../../../application/interfaces.js';
import type { WorkflowSettings } from '../../../domain/interfaces.js';
import { Workflow } from '../../../domain/workflow.js';
import type {
  GraphDto,
  NodeDto,
  NodeSettingsDto,
  WorkflowSettingsDto,
} from '../dto/graph.dto.js';

export class DraftMapper {
  static graph(dto: GraphDto): DraftGraph {
    return {
      nodes: dto.nodes.map((node) => DraftMapper.node(node)),
      connections: dto.connections.map((connection) => ({
        from: connection.from.node,
        output: connection.from.output,
        to: connection.to.node,
        input: connection.to.input,
      })),
    };
  }

  static settings(dto: WorkflowSettingsDto): WorkflowSettings {
    return {
      timezone: dto.timezone ?? Workflow.DEFAULT_SETTINGS.timezone,
      runTimeoutMs: dto.runTimeoutMs ?? Workflow.DEFAULT_SETTINGS.runTimeoutMs,
      errorWorkflowId:
        dto.errorWorkflowId ?? Workflow.DEFAULT_SETTINGS.errorWorkflowId,
    };
  }

  private static node(dto: NodeDto): DraftNode {
    const [x, y] = dto.position;
    return {
      id: dto.id,
      name: dto.name,
      type: dto.type,
      typeVersion: dto.typeVersion,
      parameters: dto.parameters ?? {},
      credentialId: dto.credentialId ?? null,
      settings: DraftMapper.nodeSettings(dto.settings),
      position: { x, y },
      note: dto.note ?? null,
      disabled: dto.disabled ?? false,
    };
  }

  private static nodeSettings(
    dto: NodeSettingsDto | undefined,
  ): DraftNodeSettings {
    if (!dto) return {};

    return {
      alwaysOutputData: dto.alwaysOutputData,
      executeOnce: dto.executeOnce,
      retry: dto.retry
        ? { attempts: dto.retry.attempts, waitMs: dto.retry.waitMs }
        : undefined,
      onError: dto.onError,
    };
  }
}
