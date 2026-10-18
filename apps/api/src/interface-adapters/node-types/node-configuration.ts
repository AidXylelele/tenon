import type { z } from 'zod';
import { OnError, ProblemCode } from '../../domain/enums.js';
import type { Graph } from '../../domain/graph.js';
import type { Problem } from '../../domain/interfaces.js';
import type { Node } from '../../domain/node.js';
import type { NodeType } from './node-type.js';
import { ParameterTree } from './parameters/parameter-tree.js';

export class NodeConfiguration {
  static readonly ERROR_OUTPUT = 'error';

  readonly #type: NodeType | undefined;
  readonly #node: Node;
  readonly #graph: Graph;

  constructor(type: NodeType | undefined, node: Node, graph: Graph) {
    this.#type = type;
    this.#node = node;
    this.#graph = graph;
  }

  problems(): Problem[] {
    if (!this.#type) {
      return [
        this.problem(
          ProblemCode.UnknownNodeType,
          null,
          `The node type ${this.#node.type} version ${this.#node.typeVersion} is not in the catalogue`,
        ),
      ];
    }

    const tree = ParameterTree.parse(this.#node.parameters);
    return [
      ...this.bindingProblems(tree),
      ...this.fixedOnlyProblems(this.#type, tree),
      ...this.schemaProblems(this.#type, tree),
      ...this.portProblems(this.#type, tree),
      ...this.credentialProblems(this.#type),
    ];
  }

  private bindingProblems(tree: ParameterTree): Problem[] {
    const problems: Problem[] = [];

    for (const value of tree.malformed) {
      const problem = this.problem(
        ProblemCode.InvalidParameter,
        value.path,
        'The value must be a fixed value, a field reference or a formula',
      );
      problems.push(problem);
    }

    for (const formula of tree.formulas) {
      if (!formula.error) continue;

      const code =
        formula.error.code === 'scope'
          ? ProblemCode.FormulaScope
          : ProblemCode.FormulaSyntax;
      const problem = this.problem(code, formula.path, formula.error.message);
      problems.push(problem);
    }

    return problems;
  }

  private fixedOnlyProblems(type: NodeType, tree: ParameterTree): Problem[] {
    const problems: Problem[] = [];

    for (const path of tree.dynamicPaths) {
      const parameter = path.split('.')[0]!;

      const fixedOnly = type.fixedParameters.includes(parameter);

      if (fixedOnly) {
        const problem = this.problem(
          ProblemCode.InvalidParameter,
          path,
          'This parameter accepts only a fixed value',
        );
        problems.push(problem);
      }
    }

    return problems;
  }

  private schemaProblems(type: NodeType, tree: ParameterTree): Problem[] {
    const sketch = tree.sketch();
    const result = type.parameters.safeParse(sketch);

    if (result.success) return [];

    const dynamic = tree.dynamicPaths;
    const malformed = tree.malformed.map((value) => value.path);
    const problems: Problem[] = [];

    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join('.');

      const covered = NodeConfiguration.covered(path, [
        ...dynamic,
        ...malformed,
      ]);

      if (covered) continue;

      const code = NodeConfiguration.codeOf(issue);
      const parameter = path === '' ? null : path;
      const problem = this.problem(code, parameter, issue.message);
      problems.push(problem);
    }

    return problems;
  }

  private portProblems(type: NodeType, tree: ParameterTree): Problem[] {
    const problems: Problem[] = [];
    const sketch = tree.sketch();
    const outputs = [...type.outputsFor(sketch)];

    if (this.#node.settings.onError === OnError.ErrorOutput) {
      outputs.push(NodeConfiguration.ERROR_OUTPUT);
    }

    for (const connection of this.#graph.outgoing(this.#node)) {
      const known = outputs.includes(connection.output);

      if (!known) {
        const problem = this.problem(
          ProblemCode.UnknownPort,
          null,
          `The node has no output ${connection.output}`,
        );
        problems.push(problem);
      }
    }

    for (const connection of this.#graph.incoming(this.#node)) {
      const known = type.inputs.includes(connection.input);

      if (!known) {
        const problem = this.problem(
          ProblemCode.UnknownPort,
          null,
          `The node has no input ${connection.input}`,
        );
        problems.push(problem);
      }
    }

    return problems;
  }

  private credentialProblems(type: NodeType): Problem[] {
    if (this.#node.credentialId === null) return [];

    if (type.credentialTypes.length > 0) return [];

    return [
      this.problem(
        ProblemCode.CredentialTypeMismatch,
        null,
        'This node type takes no credential',
      ),
    ];
  }

  private problem(
    code: ProblemCode,
    parameter: string | null,
    message: string,
  ): Problem {
    return { nodeId: this.#node.id, parameter, code, message };
  }

  private static covered(path: string, prefixes: readonly string[]): boolean {
    return prefixes.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}.`),
    );
  }

  private static codeOf(issue: z.core.$ZodIssue): ProblemCode {
    const params = (issue as { params?: { problem?: ProblemCode } }).params;
    return params?.problem ?? ProblemCode.InvalidParameter;
  }
}
