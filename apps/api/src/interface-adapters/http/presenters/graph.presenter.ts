import type {
  GraphProps,
  NodeProps,
  WorkflowSettings,
} from '../../../domain/interfaces.js';
import type {
  GraphResponse,
  NodeResponse,
  WorkflowSettingsResponse,
} from '../dto/automation-responses.dto.js';

export class GraphPresenter {
  static graph(graph: GraphProps): GraphResponse {
    return {
      nodes: graph.nodes.map((node) => GraphPresenter.node(node)),
      connections: graph.connections.map((connection) => ({
        from: { node: connection.from, output: connection.output },
        to: { node: connection.to, input: connection.input },
      })),
    };
  }

  static settings(settings: WorkflowSettings): WorkflowSettingsResponse {
    return {
      timezone: settings.timezone,
      runTimeoutMs: settings.runTimeoutMs,
      errorWorkflowId: settings.errorWorkflowId,
    };
  }

  private static node(node: NodeProps): NodeResponse {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      trigger: node.trigger,
      parameters: node.parameters,
      credentialId: node.credentialId,
      settings: {
        alwaysOutputData: node.settings.alwaysOutputData,
        executeOnce: node.settings.executeOnce,
        retry: {
          attempts: node.settings.retry.attempts,
          waitMs: node.settings.retry.waitMs,
        },
        onError: node.settings.onError,
      },
      position: [node.position.x, node.position.y],
      note: node.note,
      disabled: node.disabled,
    };
  }
}
