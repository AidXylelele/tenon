import type { Graph } from '../../domain/graph.js';
import type { Problem } from '../../domain/interfaces.js';
import type { NodeTypeCatalog } from '../interfaces.js';

export class ConfigurationCheck {
  constructor(private readonly catalogue: NodeTypeCatalog) {}

  problemsOf(graph: Graph): Problem[] {
    const problems: Problem[] = [];

    for (const node of graph.nodes) {
      const nodeProblems = this.catalogue.problemsOf(node, graph);
      problems.push(...nodeProblems);
    }

    return problems;
  }
}
