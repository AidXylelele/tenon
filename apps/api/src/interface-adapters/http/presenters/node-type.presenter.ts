import type { NodeTypeEntry } from '../../../application/interfaces.js';
import type {
  CatalogueResponse,
  NodeTypeResponse,
} from '../dto/automation-responses.dto.js';

export class NodeTypePresenter {
  static catalogue(types: readonly NodeTypeEntry[]): CatalogueResponse {
    return {
      nodeTypes: types.map((type) => NodeTypePresenter.type(type)),
      credentialTypes: [],
    };
  }

  private static type(type: NodeTypeEntry): NodeTypeResponse {
    return {
      id: type.id,
      version: type.version,
      kind: type.kind,
      trigger: type.trigger,
      category: type.category,
      displayName: type.displayName,
      description: type.description,
      parameters: { ...type.parameters },
      inputs: [...type.inputs],
      outputs:
        'fromParameter' in type.outputs
          ? { fromParameter: type.outputs.fromParameter }
          : [...type.outputs],
      credentialTypes: [...type.credentialTypes],
      defaultSettings: {
        alwaysOutputData: type.defaultSettings.alwaysOutputData,
        executeOnce: type.defaultSettings.executeOnce,
        retry: {
          attempts: type.defaultSettings.retry.attempts,
          waitMs: type.defaultSettings.retry.waitMs,
        },
        onError: type.defaultSettings.onError,
      },
    };
  }
}
