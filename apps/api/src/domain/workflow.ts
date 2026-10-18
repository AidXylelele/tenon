import { randomUUID } from 'node:crypto';
import { RunMode } from './enums.js';
import {
  NodeConfigurationError,
  NodeNotFoundError,
  NotATriggerError,
  ReleaseNotFoundError,
  ReleaseWithoutTriggerError,
  WorkflowArchivedError,
  WorkflowConflictError,
  WorkflowInactiveError,
  WorkflowNotArchivedError,
} from './errors.js';
import { Graph } from './graph.js';
import type {
  ActivationChanged,
  NewReleaseRun,
  NewTestRun,
  NewTriggeredRun,
  NewWorkflow,
  Problem,
  WorkflowProps,
  WorkflowSettings,
} from './interfaces.js';
import type { Node } from './node.js';
import { Release } from './release.js';
import { Run } from './run.js';

export class Workflow {
  static readonly DEFAULT_SETTINGS: WorkflowSettings = {
    timezone: 'UTC',
    runTimeoutMs: 60 * 60 * 1000,
    errorWorkflowId: null,
  };

  readonly #id: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #name: string;
  #ownerId: string;
  #graph: Graph;
  #settings: WorkflowSettings;
  #revision: number;
  #pinnedNodeIds: string[];
  #latestRelease: number;
  #activeRelease: number | null;
  #archivedAt: Date | null;
  #updatedAt: Date;
  #events: ActivationChanged[] = [];

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#ownerId = props.ownerId;
    this.#graph = props.graph;
    this.#settings = props.settings;
    this.#revision = props.revision;
    this.#pinnedNodeIds = [...props.pinnedNodeIds];
    this.#latestRelease = props.latestRelease;
    this.#activeRelease = props.activeRelease;
    this.#archivedAt = props.archivedAt;
    this.#createdAt = props.createdAt;
    this.#updatedAt = props.updatedAt;
    this.#version = props.version;
  }

  static create(input: NewWorkflow): Workflow {
    const id = randomUUID();
    const now = new Date();
    const graph = Graph.empty();
    return new Workflow({
      id,
      name: input.name,
      ownerId: input.ownerId,
      graph,
      settings: Workflow.DEFAULT_SETTINGS,
      revision: 1,
      pinnedNodeIds: [],
      latestRelease: 0,
      activeRelease: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  get id(): string {
    return this.#id;
  }

  get name(): string {
    return this.#name;
  }

  get ownerId(): string {
    return this.#ownerId;
  }

  get graph(): Graph {
    return this.#graph;
  }

  get settings(): WorkflowSettings {
    return this.#settings;
  }

  get revision(): number {
    return this.#revision;
  }

  get pinnedNodeIds(): readonly string[] {
    return this.#pinnedNodeIds;
  }

  get latestRelease(): number {
    return this.#latestRelease;
  }

  get activeRelease(): number | null {
    return this.#activeRelease;
  }

  get archivedAt(): Date | null {
    return this.#archivedAt;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get updatedAt(): Date {
    return this.#updatedAt;
  }

  get version(): number {
    return this.#version;
  }

  get events(): readonly ActivationChanged[] {
    return this.#events;
  }

  get isArchived(): boolean {
    return this.#archivedAt !== null;
  }

  serves(releaseNumber: number): boolean {
    return !this.isArchived && this.#activeRelease === releaseNumber;
  }

  clearEvents(): void {
    this.#events = [];
  }

  rename(name: string): void {
    this.#name = name;
    this.#updatedAt = new Date();
  }

  saveDraft(revision: number, graph: Graph, settings: WorkflowSettings): void {
    this.assertRevision(revision);

    this.#graph = graph;
    this.#settings = settings;
    this.#pinnedNodeIds = this.#pinnedNodeIds.filter((nodeId) =>
      graph.has(nodeId),
    );
    this.#revision += 1;
    this.#updatedAt = new Date();
  }

  pin(nodeId: string): void {
    const exists = this.#graph.has(nodeId);

    if (!exists) throw new NodeNotFoundError();

    const pinned = this.#pinnedNodeIds.includes(nodeId);

    if (pinned) return;

    this.#pinnedNodeIds.push(nodeId);
  }

  unpin(nodeId: string): void {
    this.#pinnedNodeIds = this.#pinnedNodeIds.filter((id) => id !== nodeId);
  }

  publish(
    revision: number,
    problems: readonly Problem[],
    publishedBy: string,
  ): Release {
    this.assertRevision(revision);

    if (problems.length > 0) throw new NodeConfigurationError(problems);

    this.#latestRelease += 1;
    this.#updatedAt = new Date();
    return new Release({
      workflowId: this.#id,
      number: this.#latestRelease,
      graph: this.#graph,
      settings: this.#settings,
      publishedAt: this.#updatedAt,
      publishedBy,
    });
  }

  activate(release: Release, problems: readonly Problem[]): void {
    if (this.isArchived) throw new WorkflowArchivedError();

    if (release.workflowId !== this.#id) throw new ReleaseNotFoundError();

    if (!release.hasTrigger) throw new ReleaseWithoutTriggerError();

    if (problems.length > 0) throw new NodeConfigurationError(problems);

    this.#activeRelease = release.number;
    this.#updatedAt = new Date();
    this.#events.push({ workflowId: this.#id });
  }

  deactivate(): void {
    if (this.#activeRelease === null) return;

    this.#activeRelease = null;
    this.#updatedAt = new Date();
    this.#events.push({ workflowId: this.#id });
  }

  archive(): void {
    if (this.isArchived) throw new WorkflowArchivedError();

    this.deactivate();
    this.#archivedAt = new Date();
    this.#updatedAt = this.#archivedAt;
  }

  restore(): void {
    if (!this.isArchived) throw new WorkflowNotArchivedError();

    this.#archivedAt = null;
    this.#updatedAt = new Date();
  }

  transferTo(ownerId: string): void {
    this.#ownerId = ownerId;
    this.#updatedAt = new Date();
  }

  duplicate(
    name: string,
    ownerId: string,
    ownedCredentialIds: ReadonlySet<string>,
  ): Workflow {
    const id = randomUUID();
    const now = new Date();
    const graph = this.#graph.keepCredentials(ownedCredentialIds);
    return new Workflow({
      id,
      name,
      ownerId,
      graph,
      settings: this.#settings,
      revision: 1,
      pinnedNodeIds: [],
      latestRelease: 0,
      activeRelease: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  startTestRun(input: NewTestRun): Run {
    if (this.isArchived) throw new WorkflowArchivedError();

    this.assertRevision(input.revision);

    if (input.problems.length > 0) {
      throw new NodeConfigurationError(input.problems);
    }

    const trigger = this.triggerIn(this.#graph, input.triggerNodeId);
    return Run.queue({
      id: input.runId,
      workflowId: this.#id,
      workflowName: this.#name,
      releaseNumber: null,
      mode: RunMode.Test,
      trigger: { type: trigger.trigger!, nodeId: trigger.id, key: null },
      graph: this.#graph,
      actingUserId: this.#ownerId,
      timeoutMs: this.#settings.runTimeoutMs,
      timezone: this.#settings.timezone,
      input: input.input,
      pins: input.pins,
    });
  }

  startManualRun(release: Release, input: NewReleaseRun): Run {
    this.assertRunnable(release);

    const trigger = this.triggerIn(release.graph, input.triggerNodeId);
    return this.releaseRun(release, {
      runId: input.runId,
      trigger: { type: trigger.trigger!, nodeId: trigger.id, key: null },
      input: input.input,
    });
  }

  startTriggeredRun(release: Release, input: NewTriggeredRun): Run {
    this.assertRunnable(release);

    const serving = this.serves(release.number);

    if (!serving) throw new WorkflowInactiveError();

    const trigger = this.triggerIn(release.graph, input.trigger.nodeId);

    if (trigger.trigger !== input.trigger.type) throw new NotATriggerError();

    return this.releaseRun(release, input);
  }

  private releaseRun(release: Release, input: NewTriggeredRun): Run {
    return Run.queue({
      id: input.runId,
      workflowId: this.#id,
      workflowName: this.#name,
      releaseNumber: release.number,
      mode: RunMode.Production,
      trigger: input.trigger,
      graph: release.graph,
      actingUserId: this.#ownerId,
      timeoutMs: release.settings.runTimeoutMs,
      timezone: release.settings.timezone,
      input: input.input,
      pins: [],
    });
  }

  private assertRunnable(release: Release): void {
    if (this.isArchived) throw new WorkflowArchivedError();

    if (release.workflowId !== this.#id) throw new ReleaseNotFoundError();
  }

  private triggerIn(graph: Graph, nodeId: string): Node {
    const node = graph.node(nodeId);

    if (!node.isTrigger) throw new NotATriggerError();

    return node;
  }

  private assertRevision(revision: number): void {
    if (revision !== this.#revision) throw new WorkflowConflictError();
  }
}
