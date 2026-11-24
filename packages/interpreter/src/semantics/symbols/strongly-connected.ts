export class StronglyConnected<Node> {
  readonly #graph: ReadonlyMap<Node, readonly Node[]>;
  readonly #order = new Map<Node, number>();
  readonly #components = new Map<Node, number>();
  readonly #open: Node[] = [];

  constructor(graph: ReadonlyMap<Node, readonly Node[]>) {
    this.#graph = graph;

    for (const [node, callees] of graph) {
      const unvisited = !this.#order.has(node);

      if (unvisited) {
        this.#visit(node, callees);
      }
    }
  }

  get components(): ReadonlyMap<Node, number> {
    return this.#components;
  }

  #visit(node: Node, callees: readonly Node[]): number {
    const order = this.#order.size;
    this.#order.set(node, order);
    this.#open.push(node);

    const reached = callees.map((callee) => this.#lowestOf(callee));
    const lowest = Math.min(order, ...reached);

    if (lowest === order) {
      this.#close(node, order);
    }

    return lowest;
  }

  #lowestOf(callee: Node): number {
    const reached = this.#order.get(callee);
    const callees = this.#graph.get(callee);
    const open = !this.#components.has(callee);

    const unvisited = reached === undefined && callees !== undefined;

    if (unvisited) {
      return this.#visit(callee, callees);
    }

    const onStack = reached !== undefined && open;

    if (onStack) {
      return reached;
    }

    return Infinity;
  }

  #close(root: Node, component: number): void {
    for (
      let node = this.#open.pop();
      node !== undefined;
      node = this.#open.pop()
    ) {
      this.#components.set(node, component);

      if (node === root) {
        return;
      }
    }
  }
}
