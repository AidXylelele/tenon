import { z } from 'zod';
import {
  NodeTypeCatalog,
  type NodeTypeEntry,
  type NodeTypeFacts,
  type Recurrence,
  type WebhookSettings,
} from '../../application/interfaces.js';
import type { Graph } from '../../domain/graph.js';
import type { Problem } from '../../domain/interfaces.js';
import type { Node } from '../../domain/node.js';
import { NodeConfiguration } from './node-configuration.js';
import type { NodeType } from './node-type.js';

export class NodeTypeRegistry extends NodeTypeCatalog {
  readonly #types: readonly NodeType[];

  constructor(types: readonly NodeType[]) {
    super();
    this.#types = types;
  }

  find(id: string, version: number): NodeType | undefined {
    return this.#types.find(
      (type) => type.id === id && type.version === version,
    );
  }

  describe(id: string, version: number): NodeTypeFacts | null {
    const type = this.find(id, version);

    if (!type) return null;

    return {
      trigger: type.trigger,
      defaultSettings: type.defaultSettings,
      credentialTypes: type.credentialTypes,
    };
  }

  problemsOf(node: Node, graph: Graph): Problem[] {
    const type = this.find(node.type, node.typeVersion);
    return new NodeConfiguration(type, node, graph).problems();
  }

  webhookOf(node: Node): WebhookSettings | null {
    const type = this.find(node.type, node.typeVersion);

    if (!type || !type.webhookOf) return null;

    return type.webhookOf(node.parameters);
  }

  schedulesOf(node: Node): Recurrence[] {
    const type = this.find(node.type, node.typeVersion);

    if (!type || !type.schedulesOf) return [];

    return type.schedulesOf(node.parameters);
  }

  list(): NodeTypeEntry[] {
    return this.#types.map((type) => ({
      id: type.id,
      version: type.version,
      kind: type.kind,
      trigger: type.trigger,
      category: type.category,
      displayName: type.displayName,
      description: type.description,
      parameters: z.toJSONSchema(type.parameters, {
        target: 'draft-2020-12',
        io: 'input',
        unrepresentable: 'any',
      }),
      inputs: type.inputs,
      outputs:
        type.outputsParameter === null
          ? type.outputsFor({})
          : { fromParameter: type.outputsParameter },
      credentialTypes: type.credentialTypes,
      defaultSettings: type.defaultSettings,
    }));
  }
}
