import { Connection } from './connection.js';
import { GraphFaultCode, type TriggerType } from './enums.js';
import { InvalidGraphError, NodeNotFoundError } from './errors.js';
import type {
  ConnectionProps,
  GraphFault,
  GraphProps,
  NodeProps,
  NodeRename,
} from './interfaces.js';
import { Node } from './node.js';

export class Graph {
  readonly #nodes: Node[] = [];
  readonly #connections: Connection[] = [];

  constructor(props: GraphProps) {
    const faults: GraphFault[] = [];

    for (const nodeProps of props.nodes) {
      const node = new Node(nodeProps);
      this.addNode(node, faults);
    }

    for (const connection of props.connections) {
      this.addConnection(connection, faults);
    }

    const traversable = Graph.isTraversable(faults);
    const cyclic = traversable && this.hasCycle();

    if (cyclic) {
      faults.push({
        code: GraphFaultCode.Cycle,
        nodeId: null,
        message: 'The graph has a cycle',
      });
    }

    if (faults.length > 0) throw new InvalidGraphError(faults);
  }

  static empty(): Graph {
    return new Graph({ nodes: [], connections: [] });
  }

  get nodes(): readonly Node[] {
    return this.#nodes;
  }

  get connections(): readonly Connection[] {
    return this.#connections;
  }

  get triggers(): Node[] {
    return this.#nodes.filter((node) => node.isTrigger);
  }

  get credentialIds(): string[] {
    const ids: string[] = [];

    for (const node of this.#nodes) {
      if (node.credentialId === null) continue;

      const listed = ids.includes(node.credentialId);

      if (!listed) ids.push(node.credentialId);
    }

    return ids;
  }

  has(nodeId: string): boolean {
    return this.find(nodeId) !== undefined;
  }

  node(nodeId: string): Node {
    const node = this.find(nodeId);

    if (!node) throw new NodeNotFoundError();

    return node;
  }

  triggersOf(type: TriggerType): Node[] {
    return this.#nodes.filter((node) => node.trigger === type);
  }

  incoming(node: Node): Connection[] {
    return this.#connections.filter((connection) => connection.to === node);
  }

  outgoing(node: Node): Connection[] {
    return this.#connections.filter((connection) => connection.from === node);
  }

  upstreamOf(node: Node): Node[] {
    const ancestors: Node[] = [];
    const pending = [node];

    while (pending.length > 0) {
      const current = pending.pop()!;

      for (const connection of this.incoming(current)) {
        const known = ancestors.includes(connection.from);

        if (!known) {
          ancestors.push(connection.from);
          pending.push(connection.from);
        }
      }
    }

    return ancestors;
  }

  orderFrom(trigger: Node): Node[] {
    const reachable = this.reachableFrom(trigger);
    const waiting = new Map<Node, number>();

    for (const node of reachable) {
      const inside = this.incoming(node).filter((connection) =>
        reachable.includes(connection.from),
      );
      waiting.set(node, inside.length);
    }

    const order: Node[] = [];
    const ready = [trigger];

    while (ready.length > 0) {
      ready.sort((a, b) => Graph.byPosition(a, b));
      const next = ready.shift()!;
      order.push(next);

      for (const connection of this.outgoing(next)) {
        const remaining = waiting.get(connection.to)! - 1;
        waiting.set(connection.to, remaining);

        if (remaining === 0) ready.push(connection.to);
      }
    }

    return order;
  }

  renamesFrom(previous: Graph): NodeRename[] {
    const renames: NodeRename[] = [];

    for (const node of this.#nodes) {
      const before = previous.find(node.id);

      if (before && before.name !== node.name) {
        renames.push({ from: before.name, to: node.name });
      }
    }

    return renames;
  }

  keepCredentials(ownedIds: ReadonlySet<string>): Graph {
    const nodes: Node[] = [];

    for (const node of this.#nodes) {
      const owned =
        node.credentialId === null || ownedIds.has(node.credentialId);
      const kept = owned ? node : node.withoutCredential();
      nodes.push(kept);
    }

    return this.rebuilt(nodes);
  }

  private rebuilt(nodes: readonly NodeProps[]): Graph {
    const connections: ConnectionProps[] = [];

    for (const connection of this.#connections) {
      connections.push({
        from: connection.from.id,
        output: connection.output,
        to: connection.to.id,
        input: connection.input,
      });
    }

    return new Graph({ nodes, connections });
  }

  private static byPosition(a: Node, b: Node): number {
    if (a.position.x !== b.position.x) return a.position.x - b.position.x;

    if (a.position.y !== b.position.y) return a.position.y - b.position.y;

    return a.id.localeCompare(b.id);
  }

  private find(nodeId: string): Node | undefined {
    return this.#nodes.find((node) => node.id === nodeId);
  }

  private addNode(node: Node, faults: GraphFault[]): void {
    const duplicateId = this.has(node.id);

    if (duplicateId) {
      faults.push({
        code: GraphFaultCode.DuplicateNodeId,
        nodeId: node.id,
        message: `Two nodes have the identifier ${node.id}`,
      });
      return;
    }

    const duplicateName = this.#nodes.some((other) => other.name === node.name);

    if (duplicateName) {
      faults.push({
        code: GraphFaultCode.DuplicateNodeName,
        nodeId: node.id,
        message: `Two nodes are named ${node.name}`,
      });
    }

    this.#nodes.push(node);
  }

  private addConnection(props: ConnectionProps, faults: GraphFault[]): void {
    const from = this.find(props.from);
    const to = this.find(props.to);

    if (!from) {
      const fault = Graph.missingNode(props.from);
      faults.push(fault);
    }

    if (!to) {
      const fault = Graph.missingNode(props.to);
      faults.push(fault);
    }

    if (from && to) {
      const connection = new Connection(from, props.output, to, props.input);
      this.#connections.push(connection);
    }
  }

  private static missingNode(nodeId: string): GraphFault {
    return {
      code: GraphFaultCode.UnknownConnectionNode,
      nodeId,
      message: `A connection refers to the node ${nodeId}, which is not in the graph`,
    };
  }

  private reachableFrom(trigger: Node): Node[] {
    const reachable = [trigger];
    const pending = [trigger];

    while (pending.length > 0) {
      const current = pending.pop()!;

      for (const connection of this.outgoing(current)) {
        const reached = reachable.includes(connection.to);

        if (!reached) {
          reachable.push(connection.to);
          pending.push(connection.to);
        }
      }
    }

    return reachable;
  }

  private static isTraversable(faults: readonly GraphFault[]): boolean {
    return faults.every(
      (fault) => fault.code === GraphFaultCode.DuplicateNodeName,
    );
  }

  private hasCycle(): boolean {
    const waiting = new Map<Node, number>();

    for (const node of this.#nodes) {
      const incoming = this.incoming(node);
      waiting.set(node, incoming.length);
    }

    const ready = this.#nodes.filter((node) => waiting.get(node) === 0);
    let visited = 0;

    while (ready.length > 0) {
      const next = ready.pop()!;
      visited += 1;

      for (const connection of this.outgoing(next)) {
        const remaining = waiting.get(connection.to)! - 1;
        waiting.set(connection.to, remaining);

        if (remaining === 0) ready.push(connection.to);
      }
    }

    return visited < this.#nodes.length;
  }
}
