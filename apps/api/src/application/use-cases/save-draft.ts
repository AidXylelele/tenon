import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import { Graph } from '../../domain/graph.js';
import type {
  NodeParameters,
  NodeProps,
  NodeRename,
  NodeSettings,
} from '../../domain/interfaces.js';
import { Node } from '../../domain/node.js';
import type {
  DraftGraph,
  DraftNode,
  DraftNodeSettings,
  FormulaEngine,
  NodeTypeCatalog,
  SaveDraftCommand,
  SavedDraft,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';
import type { ConfigurationCheck } from '../services/configuration-check.js';
import type { WebhookEndpointIssuer } from '../services/webhook-endpoint-issuer.js';

export class SaveDraft {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly catalogue: NodeTypeCatalog,
    private readonly check: ConfigurationCheck,
    private readonly formulas: FormulaEngine,
    private readonly policy: WorkflowPolicy,
    private readonly issuer: WebhookEndpointIssuer,
  ) {}

  async execute(command: SaveDraftCommand): Promise<SavedDraft> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const drafted = this.graphOf(command.graph, []);
    const renames = drafted.renamesFrom(workflow.graph);
    const graph =
      renames.length === 0 ? drafted : this.graphOf(command.graph, renames);
    workflow.saveDraft(command.revision, graph, command.settings);
    await this.workflows.update(workflow);
    await this.issuer.issueFor(workflow);
    return { workflow, problems: this.check.problemsOf(graph) };
  }

  private graphOf(draft: DraftGraph, renames: readonly NodeRename[]): Graph {
    const nodes: NodeProps[] = [];

    for (const node of draft.nodes) {
      const parameters =
        renames.length === 0
          ? node.parameters
          : this.formulas.renameNodes(node.parameters, renames);
      const nodeProps = this.nodeOf(node, parameters);
      nodes.push(nodeProps);
    }

    return new Graph({ nodes, connections: draft.connections });
  }

  private nodeOf(node: DraftNode, parameters: NodeParameters): NodeProps {
    const facts = this.catalogue.describe(node.type, node.typeVersion);
    const defaults = facts?.defaultSettings ?? Node.DEFAULT_SETTINGS;
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      trigger: facts?.trigger ?? null,
      parameters,
      credentialId: node.credentialId,
      settings: SaveDraft.settingsOf(node.settings, defaults),
      position: node.position,
      note: node.note,
      disabled: node.disabled,
    };
  }

  private static settingsOf(
    draft: DraftNodeSettings,
    defaults: NodeSettings,
  ): NodeSettings {
    return {
      alwaysOutputData: draft.alwaysOutputData ?? defaults.alwaysOutputData,
      executeOnce: draft.executeOnce ?? defaults.executeOnce,
      retry: {
        attempts: draft.retry?.attempts ?? defaults.retry.attempts,
        waitMs: draft.retry?.waitMs ?? defaults.retry.waitMs,
      },
      onError: draft.onError ?? defaults.onError,
    };
  }
}
