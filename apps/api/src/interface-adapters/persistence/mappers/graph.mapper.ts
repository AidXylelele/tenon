import { Graph } from '../../../domain/graph.js';
import type {
  ConnectionProps,
  GraphProps,
  NodeProps,
} from '../../../domain/interfaces.js';

export class GraphMapper {
  static toProps(graph: Graph): GraphProps {
    const nodes: NodeProps[] = [];

    for (const node of graph.nodes) {
      nodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        trigger: node.trigger,
        parameters: node.parameters,
        credentialId: node.credentialId,
        settings: node.settings,
        position: node.position,
        note: node.note,
        disabled: node.disabled,
      });
    }

    const connections: ConnectionProps[] = [];

    for (const connection of graph.connections) {
      connections.push({
        from: connection.from.id,
        output: connection.output,
        to: connection.to.id,
        input: connection.input,
      });
    }

    return { nodes, connections };
  }

  static toGraph(props: GraphProps): Graph {
    return new Graph(props);
  }
}
