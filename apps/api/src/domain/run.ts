import { createHash, randomUUID } from 'node:crypto';
import { Arrival, ErrorKind, OnError, RunMode, RunStatus } from './enums.js';
import { RunConflictError, RunFinishedError } from './errors.js';
import type { Graph } from './graph.js';
import type {
  InputPort,
  NewRun,
  NodeFailure,
  NodeInput,
  PinnedOutput,
  RunError,
  RunLimits,
  RunProps,
  RunTrigger,
  StepOutput,
  UpstreamOutput,
} from './interfaces.js';
import type { Node } from './node.js';
import { Step } from './step.js';

export class Run {
  static readonly ENDED_BEFORE_START: NodeFailure = {
    kind: ErrorKind.Cancelled,
    message: 'The run ended before the node started',
    parameter: null,
    item: null,
    typeUnavailable: false,
  };

  readonly #id: string;
  readonly #workflowId: string;
  readonly #workflowName: string;
  readonly #releaseNumber: number | null;
  readonly #mode: RunMode;
  readonly #trigger: RunTrigger;
  readonly #graph: Graph;
  readonly #actingUserId: string;
  readonly #timeoutMs: number;
  readonly #timezone: string;
  readonly #input: readonly StepOutput[];
  readonly #pins: readonly PinnedOutput[];
  readonly #steps: Step[];
  readonly #queuedAt: Date;
  readonly #version: number;
  #status: RunStatus;
  #error: RunError | null;
  #startedAt: Date | null;
  #finishedAt: Date | null;

  constructor(props: RunProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#workflowName = props.workflowName;
    this.#releaseNumber = props.releaseNumber;
    this.#mode = props.mode;
    this.#trigger = props.trigger;
    this.#graph = props.graph;
    this.#actingUserId = props.actingUserId;
    this.#timeoutMs = props.timeoutMs;
    this.#timezone = props.timezone;
    this.#input = props.input;
    this.#pins = props.pins;
    this.#status = props.status;
    this.#error = props.error;
    this.#steps = props.steps.map((step) => new Step(step));
    this.#queuedAt = props.queuedAt;
    this.#startedAt = props.startedAt;
    this.#finishedAt = props.finishedAt;
    this.#version = props.version;
  }

  static queue(input: NewRun): Run {
    const now = new Date();
    return new Run({
      id: input.id,
      workflowId: input.workflowId,
      workflowName: input.workflowName,
      releaseNumber: input.releaseNumber,
      mode: input.mode,
      trigger: input.trigger,
      graph: input.graph,
      actingUserId: input.actingUserId,
      timeoutMs: input.timeoutMs,
      timezone: input.timezone,
      input: input.input,
      pins: input.pins,
      status: RunStatus.Queued,
      error: null,
      steps: [],
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      version: 1,
    });
  }

  static newId(key: string | null): string {
    if (key === null) return randomUUID();

    const bytes = createHash('sha256').update(key).digest().subarray(0, 16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x80;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  get id(): string {
    return this.#id;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get workflowName(): string {
    return this.#workflowName;
  }

  get releaseNumber(): number | null {
    return this.#releaseNumber;
  }

  get mode(): RunMode {
    return this.#mode;
  }

  get trigger(): RunTrigger {
    return this.#trigger;
  }

  get graph(): Graph {
    return this.#graph;
  }

  get actingUserId(): string {
    return this.#actingUserId;
  }

  get timeoutMs(): number {
    return this.#timeoutMs;
  }

  get timezone(): string {
    return this.#timezone;
  }

  get input(): readonly StepOutput[] {
    return this.#input;
  }

  get pins(): readonly PinnedOutput[] {
    return this.#pins;
  }

  get status(): RunStatus {
    return this.#status;
  }

  get error(): RunError | null {
    return this.#error;
  }

  get steps(): readonly Step[] {
    return this.#steps;
  }

  get queuedAt(): Date {
    return this.#queuedAt;
  }

  get startedAt(): Date | null {
    return this.#startedAt;
  }

  get finishedAt(): Date | null {
    return this.#finishedAt;
  }

  get version(): number {
    return this.#version;
  }

  get isFinished(): boolean {
    return (
      this.#status === RunStatus.Succeeded ||
      this.#status === RunStatus.Failed ||
      this.#status === RunStatus.Cancelled
    );
  }

  get order(): Node[] {
    const trigger = this.#graph.node(this.#trigger.nodeId);
    return this.#graph.orderFrom(trigger);
  }

  step(nodeId: string): Step | undefined {
    return this.#steps.find((step) => step.nodeId === nodeId);
  }

  begin(): void {
    if (this.#status !== RunStatus.Queued) return;

    this.#status = RunStatus.Running;
    this.#startedAt = new Date();
  }

  reach(nodeId: string): Arrival {
    if (this.isFinished) return Arrival.Stop;

    const reached = this.step(nodeId);

    if (reached) return reached.isRunning ? Arrival.Execute : Arrival.Done;

    const node = this.#graph.node(nodeId);

    if (node.id === this.#trigger.nodeId) {
      const outputs = this.triggerOutputs();
      return this.handOn(node.id, outputs);
    }

    const input = this.inputOf(nodeId);
    const received = this.received(input);

    if (!received && !node.settings.alwaysOutputData) {
      const skipped = Step.skip(node.id);
      this.#steps.push(skipped);
      return Arrival.Done;
    }

    if (node.disabled) {
      const passedOn = this.passOn(input);
      return this.handOn(node.id, passedOn);
    }

    const pin = this.pinOf(node.id);

    if (pin) return this.handOn(node.id, pin.outputs);

    const started = Step.start(node.id);
    this.#steps.push(started);
    return Arrival.Execute;
  }

  inputOf(nodeId: string): NodeInput {
    const node = this.#graph.node(nodeId);
    return {
      node,
      ports: this.portsOf(node),
      upstream: this.upstreamOutputsOf(node),
      firstItemOnly: node.settings.executeOnce,
      emptyItemWhenSilent: node.settings.alwaysOutputData,
    };
  }

  complete(
    nodeId: string,
    attempt: number,
    outputs: readonly StepOutput[],
    limits: RunLimits,
  ): void {
    const step = this.executingStep(nodeId);

    if (!step.isRunning) return;

    step.succeed(attempt, outputs);

    if (this.isFinished) return;

    const bytes = this.executedBytes();

    if (bytes > limits.runBytes) {
      this.end(RunStatus.Failed, {
        nodeId,
        kind: ErrorKind.Limit,
        message: `The outputs of the run exceed ${limits.runBytes} bytes at node ${nodeId}`,
      });
    }
  }

  fail(
    nodeId: string,
    attempt: number,
    failure: NodeFailure,
    outputs: readonly StepOutput[],
  ): void {
    const step = this.executingStep(nodeId);

    if (!step.isRunning) return;

    const onError =
      failure.kind === ErrorKind.Limit
        ? OnError.Stop
        : this.#graph.node(nodeId).settings.onError;

    if (onError === OnError.Continue) {
      const input = this.inputOf(nodeId);
      const passedOn = this.passOn(input);
      step.fail(attempt, failure, passedOn);
      return;
    }

    if (onError === OnError.ErrorOutput) {
      step.fail(attempt, failure, outputs);
      return;
    }

    step.fail(attempt, failure, []);

    if (this.isFinished) return;

    this.end(RunStatus.Failed, {
      nodeId,
      kind: failure.kind,
      message: failure.message,
    });
  }

  finish(): void {
    if (this.#status !== RunStatus.Running) return;

    this.#status = RunStatus.Succeeded;
    this.#finishedAt = new Date();
  }

  cancel(): void {
    if (this.isFinished) throw new RunFinishedError();

    this.end(RunStatus.Cancelled, {
      nodeId: null,
      kind: ErrorKind.Cancelled,
      message: 'The run was cancelled',
    });
  }

  terminate(error: RunError): void {
    for (const step of this.#steps) {
      if (step.isRunning) {
        const failure = Run.failureOf(error);
        step.fail(step.attempts, failure, []);
      }
    }

    if (this.isFinished) return;

    const status =
      error.kind === ErrorKind.Cancelled
        ? RunStatus.Cancelled
        : RunStatus.Failed;
    this.end(status, error);
  }

  private static failureOf(error: RunError): NodeFailure {
    return {
      kind: error.kind,
      message: error.message,
      parameter: null,
      item: null,
      typeUnavailable: false,
    };
  }

  private end(status: RunStatus, error: RunError): void {
    this.#status = status;
    this.#error = error;
    this.#finishedAt = new Date();
  }

  private handOn(nodeId: string, outputs: readonly StepOutput[]): Arrival {
    const handedOn = Step.handOn(nodeId, outputs);
    this.#steps.push(handedOn);
    return Arrival.Done;
  }

  private triggerOutputs(): readonly StepOutput[] {
    if (this.#input.length > 0) return this.#input;

    const pin = this.pinOf(this.#trigger.nodeId);
    return pin ? pin.outputs : [];
  }

  private pinOf(nodeId: string): PinnedOutput | undefined {
    if (this.#mode !== RunMode.Test) return undefined;

    return this.#pins.find((pin) => pin.nodeId === nodeId);
  }

  private executingStep(nodeId: string): Step {
    const step = this.step(nodeId);

    if (!step) throw new RunConflictError();

    return step;
  }

  private received(input: NodeInput): boolean {
    for (const port of input.ports) {
      for (const output of port.outputs) {
        if (output.items > 0) return true;
      }
    }

    return false;
  }

  private passOn(input: NodeInput): StepOutput[] {
    const first = input.ports[0];

    if (!first) return [];

    const outputs: StepOutput[] = [];

    for (const output of first.outputs) {
      outputs.push({
        port: 'main',
        items: output.items,
        bytes: output.bytes,
        key: output.key,
        chunkStarts: output.chunkStarts,
      });
    }

    return outputs;
  }

  private portsOf(node: Node): InputPort[] {
    const names: string[] = [];

    for (const connection of this.#graph.incoming(node)) {
      const known = names.includes(connection.input);

      if (!known) names.push(connection.input);
    }

    names.sort();
    const ports: InputPort[] = [];

    for (const name of names) {
      const outputs = this.outputsInto(node, name);
      ports.push({ port: name, outputs });
    }

    return ports;
  }

  private outputsInto(node: Node, input: string): StepOutput[] {
    const outputs: StepOutput[] = [];

    for (const connection of this.#graph.incoming(node)) {
      if (connection.input !== input) continue;

      const upstream = this.step(connection.from.id);

      if (!upstream) continue;

      for (const output of upstream.outputs) {
        if (output.port === connection.output) outputs.push(output);
      }
    }

    return outputs;
  }

  private upstreamOutputsOf(node: Node): UpstreamOutput[] {
    const ancestors = this.#graph.upstreamOf(node);
    const upstream: UpstreamOutput[] = [];

    for (const visited of this.order) {
      const step = this.step(visited.id);
      const ancestor = ancestors.includes(visited);

      if (step && ancestor) {
        upstream.push({
          nodeId: visited.id,
          name: visited.name,
          outputs: step.outputs,
        });
      }
    }

    return upstream;
  }

  private executedBytes(): number {
    let bytes = 0;

    for (const step of this.#steps) {
      bytes += step.executedBytes;
    }

    return bytes;
  }
}
