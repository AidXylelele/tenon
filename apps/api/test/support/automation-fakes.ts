import {
  ArtifactStore,
  FormulaEngine,
  NodeExecutor,
  NodeSamples,
  NodeTypeCatalog,
  SecretCipher,
  WebhookEndpointRepository,
  WorkflowQueries,
  type Assignment,
  type NodeOutcome,
  type OutputTarget,
  type RunRepository,
  type FieldShape,
  type Item,
  type NodeTypeEntry,
  type NodeTypeFacts,
  type ReleaseRepository,
  type Page,
  type Recurrence,
  type ReleaseSummary,
  type ReleaseView,
  type WebhookSettings,
  type WorkflowRepository,
  type WorkflowSummary,
  type WorkflowView,
} from '../../src/application/interfaces.js';
import type { User } from '../../src/domain/user.js';
import type { WebhookEndpoint } from '../../src/domain/webhook-endpoint.js';
import { GraphMapper } from '../../src/interface-adapters/persistence/mappers/graph.mapper.js';
import type { ActivationChanged } from '../../src/domain/interfaces.js';
import {
  ReleaseNotFoundError,
  RunNotFoundError,
  WorkflowNotFoundError,
} from '../../src/domain/errors.js';
import type {
  EncryptedSecret,
  NodeParameters,
  NodeRename,
  NodeSettings,
  Problem,
  StepOutput,
} from '../../src/domain/interfaces.js';
import type { Node } from '../../src/domain/node.js';
import type { Release } from '../../src/domain/release.js';
import type { Run } from '../../src/domain/run.js';
import type { Workflow } from '../../src/domain/workflow.js';

export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly workflows = new Map<string, Workflow>();
  readonly published: ActivationChanged[] = [];

  constructor(...workflows: Workflow[]) {
    for (const workflow of workflows) this.workflows.set(workflow.id, workflow);
  }

  async add(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    this.publish(workflow);
  }

  async update(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    this.publish(workflow);
  }

  async getById(id: string): Promise<Workflow> {
    const workflow = this.workflows.get(id);

    if (!workflow) throw new WorkflowNotFoundError();

    return workflow;
  }

  private publish(workflow: Workflow): void {
    this.published.push(...workflow.events);
    workflow.clearEvents();
  }
}

export class InMemoryReleaseRepository implements ReleaseRepository {
  readonly releases: Release[] = [];

  constructor(...releases: Release[]) {
    this.releases.push(...releases);
  }

  async add(release: Release): Promise<void> {
    this.releases.push(release);
  }

  async get(workflowId: string, number: number): Promise<Release> {
    const release = this.releases.find(
      (candidate) =>
        candidate.workflowId === workflowId && candidate.number === number,
    );

    if (!release) throw new ReleaseNotFoundError();

    return release;
  }
}

export class FakeNodeTypeCatalog extends NodeTypeCatalog {
  readonly facts = new Map<string, NodeTypeFacts>();
  readonly problems = new Map<string, Problem[]>();
  webhookSettings: WebhookSettings = {
    methods: ['POST'],
    authentication: 'token',
  };
  recurrences: Recurrence[] = [];

  type(
    id: string,
    facts: Partial<NodeTypeFacts> & { defaultSettings: NodeSettings },
  ): this {
    this.facts.set(id, { trigger: null, credentialTypes: [], ...facts });
    return this;
  }

  failing(nodeId: string, problem: Problem): this {
    this.problems.set(nodeId, [problem]);
    return this;
  }

  describe(type: string): NodeTypeFacts | null {
    return this.facts.get(type) ?? null;
  }

  problemsOf(node: Node): Problem[] {
    return this.problems.get(node.id) ?? [];
  }

  webhook(settings: WebhookSettings): this {
    this.webhookSettings = settings;
    return this;
  }

  webhookOf(node: Node): WebhookSettings | null {
    return node.type === 'webhook' ? this.webhookSettings : null;
  }

  schedules(recurrences: Recurrence[]): this {
    this.recurrences = recurrences;
    return this;
  }

  schedulesOf(node: Node): Recurrence[] {
    return node.type === 'scheduleTrigger' ? this.recurrences : [];
  }

  list(): NodeTypeEntry[] {
    return [];
  }
}

export class FakeSecretCipher extends SecretCipher {
  encrypt(plain: string): EncryptedSecret {
    return {
      ciphertext: Buffer.from(plain).toString('base64'),
      keyVersion: 'k1',
    };
  }

  decrypt(secret: EncryptedSecret): string | null {
    if (secret.keyVersion !== 'k1') return null;

    return Buffer.from(secret.ciphertext, 'base64').toString();
  }
}

export class InMemoryWebhookEndpointRepository extends WebhookEndpointRepository {
  readonly endpoints = new Map<string, WebhookEndpoint>();

  async add(endpoint: WebhookEndpoint): Promise<void> {
    this.endpoints.set(endpoint.id, endpoint);
  }

  async update(endpoint: WebhookEndpoint): Promise<void> {
    this.endpoints.set(endpoint.id, endpoint);
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.get(id) ?? null;
  }

  async findByNode(
    workflowId: string,
    nodeId: string,
  ): Promise<WebhookEndpoint | null> {
    const endpoints = await this.listByWorkflow(workflowId);
    return endpoints.find((endpoint) => endpoint.nodeId === nodeId) ?? null;
  }

  async listByWorkflow(workflowId: string): Promise<WebhookEndpoint[]> {
    return [...this.endpoints.values()].filter(
      (endpoint) => endpoint.workflowId === workflowId,
    );
  }
}

export class InMemoryWorkflowQueries extends WorkflowQueries {
  constructor(
    private readonly workflows: InMemoryWorkflowRepository,
    private readonly owner: User,
    private readonly stored = new InMemoryReleaseRepository(),
  ) {
    super();
  }

  list(): Promise<Page<WorkflowSummary>> {
    return Promise.resolve({ items: [], nextCursor: null });
  }

  async get(id: string): Promise<WorkflowView> {
    const workflow = await this.workflows.getById(id);
    return {
      id: workflow.id,
      name: workflow.name,
      owner: { id: workflow.ownerId, name: this.owner.name },
      archived: workflow.isArchived,
      latestRelease: workflow.latestRelease,
      activeRelease: workflow.activeRelease,
      updatedAt: workflow.updatedAt,
      revision: workflow.revision,
      graph: GraphMapper.toProps(workflow.graph),
      settings: workflow.settings,
      samples: [],
    };
  }

  releases(): Promise<ReleaseSummary[]> {
    return Promise.resolve([]);
  }

  async release(workflowId: string, number: number): Promise<ReleaseView> {
    const release = await this.stored.get(workflowId, number);
    return {
      number: release.number,
      publishedAt: release.publishedAt,
      publishedBy: { id: release.publishedBy, name: this.owner.name },
      graph: GraphMapper.toProps(release.graph),
      settings: release.settings,
    };
  }

  async activeIds(): Promise<string[]> {
    return [...this.workflows.workflows.values()]
      .filter((workflow) => workflow.activeRelease !== null)
      .map((workflow) => workflow.id);
  }
}

export class FakeFormulaEngine extends FormulaEngine {
  renameNodes(
    parameters: NodeParameters,
    renames: readonly NodeRename[],
  ): NodeParameters {
    const names = new Map(renames.map((rename) => [rename.from, rename.to]));
    const text = JSON.stringify(parameters).replace(
      /\$\('([^']*)'\)/g,
      (call, name: string) => {
        const renamed = names.get(name);
        return renamed === undefined ? call : `$('${renamed}')`;
      },
    );
    return JSON.parse(text) as NodeParameters;
  }
}

export class InMemoryNodeSamples extends NodeSamples {
  readonly pins = new Map<string, readonly Item[]>();
  readonly fields = new Map<string, readonly FieldShape[]>();

  async pin(
    workflowId: string,
    nodeId: string,
    items: readonly Item[],
  ): Promise<void> {
    this.pins.set(`${workflowId}/${nodeId}`, items);
  }

  async unpin(workflowId: string, nodeId: string): Promise<void> {
    this.pins.delete(`${workflowId}/${nodeId}`);
  }

  async pinned(workflowId: string, nodeId: string): Promise<readonly Item[]> {
    return this.pins.get(`${workflowId}/${nodeId}`) ?? [];
  }

  async recordFields(
    workflowId: string,
    nodeId: string,
    fields: readonly FieldShape[],
  ): Promise<void> {
    this.fields.set(`${workflowId}/${nodeId}`, fields);
  }
}

export class InMemoryRunRepository implements RunRepository {
  readonly runs = new Map<string, Run>();

  constructor(...runs: Run[]) {
    for (const run of runs) this.runs.set(run.id, run);
  }

  async add(run: Run): Promise<void> {
    this.runs.set(run.id, run);
  }

  async update(run: Run): Promise<void> {
    this.runs.set(run.id, run);
  }

  async getById(id: string): Promise<Run> {
    const run = this.runs.get(id);

    if (!run) throw new RunNotFoundError();

    return run;
  }

  async findById(id: string): Promise<Run | null> {
    return this.runs.get(id) ?? null;
  }
}

export class InMemoryArtifactStore extends ArtifactStore {
  readonly objects = new Map<string, readonly Item[]>();

  async write(
    target: OutputTarget,
    items: readonly Item[],
  ): Promise<StepOutput> {
    const key = `runs/${target.runId}/nodes/${target.nodeId}/a${target.attempt}/${target.port}`;
    this.objects.set(key, items);
    return {
      port: target.port,
      items: items.length,
      bytes: JSON.stringify(items).length,
      key,
      chunkStarts: [0],
    };
  }

  async read(
    outputs: readonly StepOutput[],
    offset: number,
    limit: number,
  ): Promise<Item[]> {
    const items = await this.readAll(outputs);
    return items.slice(offset, offset + limit);
  }

  async readAll(outputs: readonly StepOutput[]): Promise<Item[]> {
    const items: Item[] = [];

    for (const output of outputs) {
      items.push(...(this.objects.get(output.key) ?? []));
    }

    return items;
  }
}

export class ScriptedNodeExecutor extends NodeExecutor {
  readonly assignments: Assignment[] = [];
  readonly outcomes = new Map<string, NodeOutcome>();

  answer(nodeId: string, outcome: NodeOutcome): this {
    this.outcomes.set(nodeId, outcome);
    return this;
  }

  async execute(assignment: Assignment): Promise<NodeOutcome> {
    this.assignments.push(assignment);
    return (
      this.outcomes.get(assignment.input.node.id) ?? {
        outputs: [],
        failure: null,
        fields: [],
      }
    );
  }
}
