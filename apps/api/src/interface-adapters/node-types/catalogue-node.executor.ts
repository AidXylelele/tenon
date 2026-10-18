import { DateTime } from 'luxon';
import {
  type ArtifactStore,
  type Assignment,
  type Item,
  NodeExecutor,
  type NodeOutcome,
} from '../../application/interfaces.js';
import { ErrorKind, OnError } from '../../domain/enums.js';
import type {
  InputPort,
  NodeFailure,
  StepOutput,
  UpstreamOutput,
} from '../../domain/interfaces.js';
import type { Run } from '../../domain/run.js';
import type { FormulaExecution } from '../formulas/formula-scope.js';
import { FieldShapes } from './field-shapes.js';
import { NodeExecution } from './node-execution.js';
import { NodeLimitError } from './node-limit-error.js';
import type { NodeResult, NodeType, StepLimits } from './node-type.js';
import type { NodeTypeRegistry } from './node-type.registry.js';
import { NodeUserError } from './node-user-error.js';
import { ParameterTree } from './parameters/parameter-tree.js';
import type { UpstreamItems } from './parameters/resolution-context.js';

export class CatalogueNodeExecutor extends NodeExecutor {
  static readonly ERROR_PORT = 'error';

  constructor(
    private readonly registry: NodeTypeRegistry,
    private readonly artifacts: ArtifactStore,
    private readonly limits: StepLimits,
  ) {
    super();
  }

  async execute(assignment: Assignment): Promise<NodeOutcome> {
    const { node } = assignment.input;
    const type = this.registry.find(node.type, node.typeVersion);

    if (!type) {
      return CatalogueNodeExecutor.failed({
        kind: ErrorKind.Platform,
        message: `The node type ${node.type} version ${node.typeVersion} is not available on this process`,
        parameter: null,
        item: null,
        typeUnavailable: true,
      });
    }

    const inputs = await this.inputsOf(assignment.input.ports);

    try {
      const result = await this.run(type, assignment, inputs);
      return await this.stored(assignment, result);
    } catch (error) {
      const failure = CatalogueNodeExecutor.failureOf(error);
      const outputs = await this.errorOutputs(assignment, inputs, failure);
      return { outputs, failure, fields: [] };
    }
  }

  private async run(
    type: NodeType,
    assignment: Assignment,
    inputs: ReadonlyMap<string, readonly Item[]>,
  ): Promise<NodeResult> {
    const { node } = assignment.input;
    const upstream = await this.upstreamOf(assignment);
    const now = DateTime.now();
    const formulaExecution = CatalogueNodeExecutor.executionOf(assignment.run);
    const execution = new NodeExecution({
      schema: type.parameters,
      limits: this.limits,
      parameters: node.parameters,
      inputs,
      upstream,
      firstItemOnly: assignment.input.firstItemOnly,
      now,
      timezone: assignment.run.timezone,
      execution: formulaExecution,
      workflow: {
        id: assignment.run.workflowId,
        name: assignment.run.workflowName,
        version: assignment.run.releaseNumber,
      },
    });
    const result = await type.execute(execution);
    const silent = this.isSilent(result);

    if (!assignment.input.emptyItemWhenSilent || !silent) {
      return result;
    }

    const [port = 'main'] = Object.keys(result);
    const filled: [string, readonly Item[]][] = [[port, [{}]]];

    for (const name of Object.keys(result)) {
      if (name !== port) filled.push([name, []]);
    }

    return Object.fromEntries(filled);
  }

  private async stored(
    assignment: Assignment,
    result: NodeResult,
  ): Promise<NodeOutcome> {
    const outputs: StepOutput[] = [];

    for (const [port, items] of Object.entries(result)) {
      this.checkLimits(port, items);
      const output = await this.write(assignment, port, items);
      outputs.push(output);
    }

    const [first] = Object.values(result);
    const firstItems = first ?? [];
    const fields = FieldShapes.of(firstItems);
    return { outputs, failure: null, fields };
  }

  private async errorOutputs(
    assignment: Assignment,
    inputs: ReadonlyMap<string, readonly Item[]>,
    failure: NodeFailure,
  ): Promise<StepOutput[]> {
    if (assignment.input.node.settings.onError !== OnError.ErrorOutput) {
      return [];
    }

    const [items] = inputs.values();
    const failed: Item[] = [];

    for (const item of items ?? []) {
      failed.push({ ...item, error: failure.message });
    }

    const output = await this.write(
      assignment,
      CatalogueNodeExecutor.ERROR_PORT,
      failed,
    );
    return [output];
  }

  private write(
    assignment: Assignment,
    port: string,
    items: readonly Item[],
  ): Promise<StepOutput> {
    return this.artifacts.write(
      {
        runId: assignment.run.id,
        nodeId: assignment.input.node.id,
        attempt: assignment.attempt,
        port,
      },
      items,
    );
  }

  private async inputsOf(
    ports: readonly InputPort[],
  ): Promise<Map<string, readonly Item[]>> {
    const inputs = new Map<string, readonly Item[]>();

    for (const port of ports) {
      const items = await this.artifacts.readAll(port.outputs);
      inputs.set(port.port, items);
    }

    return inputs;
  }

  private async upstreamOf(assignment: Assignment): Promise<UpstreamItems[]> {
    const tree = ParameterTree.parse(assignment.input.node.parameters);
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const reference of tree.references) {
      ids.add(reference.node);
    }

    for (const formula of tree.formulas) {
      for (const name of formula.nodeNames) {
        names.add(name);
      }
    }

    const upstream: UpstreamItems[] = [];

    for (const node of assignment.input.upstream) {
      const referenced = ids.has(node.nodeId);
      const named = names.has(node.name);

      if (!referenced && !named) continue;

      const outputs = CatalogueNodeExecutor.mainOutputs(node);
      const items = await this.artifacts.readAll(outputs);
      upstream.push({ nodeId: node.nodeId, name: node.name, items });
    }

    return upstream;
  }

  private checkLimits(port: string, items: readonly Item[]): void {
    if (items.length > this.limits.items) {
      throw new NodeLimitError(
        `The output ${port} has more than ${this.limits.items} items`,
      );
    }

    let bytes = 0;

    for (const item of items) {
      const text = JSON.stringify(item);
      bytes += Buffer.byteLength(text) + 1;

      if (bytes > this.limits.bytes) {
        throw new NodeLimitError(
          `The output ${port} is larger than ${this.limits.bytes} bytes`,
        );
      }
    }
  }

  private isSilent(result: NodeResult): boolean {
    return Object.values(result).every((items) => items.length === 0);
  }

  private static mainOutputs(node: UpstreamOutput): StepOutput[] {
    const [first] = node.outputs;

    if (!first) return [];

    return node.outputs.filter((output) => output.port === first.port);
  }

  private static executionOf(run: Run): FormulaExecution {
    return {
      id: run.id,
      mode: run.mode,
      startedAt: (run.startedAt ?? run.queuedAt).toISOString(),
    };
  }

  private static failureOf(error: unknown): NodeFailure {
    if (error instanceof NodeUserError) {
      return {
        kind: ErrorKind.User,
        message: error.message,
        parameter: error.parameter,
        item: error.item,
        typeUnavailable: false,
      };
    }

    const kind =
      error instanceof NodeLimitError ? ErrorKind.Limit : ErrorKind.Platform;
    const message =
      error instanceof NodeLimitError
        ? error.message
        : 'The node failed because of an internal error';
    return {
      kind,
      message,
      parameter: null,
      item: null,
      typeUnavailable: false,
    };
  }

  private static failed(failure: NodeFailure): NodeOutcome {
    return { outputs: [], failure, fields: [] };
  }
}
