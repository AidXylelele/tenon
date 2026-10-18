import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { ArchiveWorkflow } from '../../../src/application/use-cases/archive-workflow.js';
import { CreateWorkflow } from '../../../src/application/use-cases/create-workflow.js';
import { WebhookEndpointIssuer } from '../../../src/application/services/webhook-endpoint-issuer.js';
import { DuplicateWorkflow } from '../../../src/application/use-cases/duplicate-workflow.js';
import { PinSample } from '../../../src/application/use-cases/pin-sample.js';
import { PublishRelease } from '../../../src/application/use-cases/publish-release.js';
import { RenameWorkflow } from '../../../src/application/use-cases/rename-workflow.js';
import { RestoreWorkflow } from '../../../src/application/use-cases/restore-workflow.js';
import { TransferWorkflow } from '../../../src/application/use-cases/transfer-workflow.js';
import { UnpinSample } from '../../../src/application/use-cases/unpin-sample.js';
import { ProblemCode, Role } from '../../../src/domain/enums.js';
import {
  InvalidOwnerError,
  NodeConfigurationError,
  NodeNotFoundError,
  WorkflowAccessDeniedError,
} from '../../../src/domain/errors.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';
import {
  FakeNodeTypeCatalog,
  InMemoryNodeSamples,
  InMemoryReleaseRepository,
  InMemoryWorkflowRepository,
  FakeSecretCipher,
  InMemoryWebhookEndpointRepository,
} from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';
import { InMemoryUserRepository } from '../../support/fakes.js';

const owner = aUser({ id: 'owner-1', role: Role.Editor });
const stranger = aUser({ id: 'editor-2', role: Role.Editor });
const viewer = aUser({ id: 'viewer-1', role: Role.Viewer });
const policy = new WorkflowPolicy();

const withDraft = () => {
  const workflow = Workflow.create({ name: 'Orders', ownerId: owner.id });
  workflow.saveDraft(
    1,
    aGraph([aTrigger('start'), aNode('a')], [link('start', 'a')]),
    workflow.settings,
  );
  return { workflow, workflows: new InMemoryWorkflowRepository(workflow) };
};

describe('workflow commands', () => {
  it('an_editor_creates_a_workflow_and_owns_it', async () => {
    const workflows = new InMemoryWorkflowRepository();
    const workflow = await new CreateWorkflow(workflows).execute({
      actor: owner,
      name: 'Orders',
    });
    expect(workflow.ownerId).toBe(owner.id);
    expect(workflows.workflows.get(workflow.id)).toBe(workflow);
  });

  it('the_owner_renames_and_a_stranger_cannot', async () => {
    const { workflow, workflows } = withDraft();
    const rename = new RenameWorkflow(workflows, policy);
    await rename.execute({
      actor: owner,
      workflowId: workflow.id,
      name: 'Invoices',
    });
    expect(workflow.name).toBe('Invoices');
    await expect(
      rename.execute({ actor: stranger, workflowId: workflow.id, name: 'X' }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
  });

  it('publishing_creates_the_next_release_when_no_node_has_a_configuration_problem', async () => {
    const { workflow, workflows } = withDraft();
    const releases = new InMemoryReleaseRepository();
    const catalogue = new FakeNodeTypeCatalog();
    const publish = new PublishRelease(
      workflows,
      releases,
      new ConfigurationCheck(catalogue),
      policy,
    );
    const release = await publish.execute({
      actor: owner,
      workflowId: workflow.id,
      revision: 2,
    });
    expect(release.number).toBe(1);
    expect(releases.releases).toEqual([release]);
    expect(workflow.latestRelease).toBe(1);
  });

  it('publishing_is_refused_with_every_configuration_problem', async () => {
    const { workflow, workflows } = withDraft();
    const releases = new InMemoryReleaseRepository();
    const catalogue = new FakeNodeTypeCatalog().failing('a', {
      nodeId: 'a',
      parameter: 'value',
      code: ProblemCode.InvalidParameter,
      message: 'Required',
    });
    const publish = new PublishRelease(
      workflows,
      releases,
      new ConfigurationCheck(catalogue),
      policy,
    );
    await expect(
      publish.execute({ actor: owner, workflowId: workflow.id, revision: 2 }),
    ).rejects.toBeInstanceOf(NodeConfigurationError);
    expect(releases.releases).toEqual([]);
  });

  it('archiving_and_restoring_belong_to_the_owner', async () => {
    const { workflow, workflows } = withDraft();
    await expect(
      new ArchiveWorkflow(workflows, policy).execute({
        actor: stranger,
        workflowId: workflow.id,
      }),
    ).rejects.toBeInstanceOf(WorkflowAccessDeniedError);
    await new ArchiveWorkflow(workflows, policy).execute({
      actor: owner,
      workflowId: workflow.id,
    });
    expect(workflow.isArchived).toBe(true);
    await new RestoreWorkflow(workflows, policy).execute({
      actor: owner,
      workflowId: workflow.id,
    });
    expect(workflow.isArchived).toBe(false);
  });

  it('any_editor_duplicates_a_workflow_and_owns_the_copy', async () => {
    const { workflow, workflows } = withDraft();
    const copy = await new DuplicateWorkflow(
      workflows,
      new WebhookEndpointIssuer(
        new InMemoryWebhookEndpointRepository(),
        new FakeSecretCipher(),
      ),
    ).execute({
      actor: stranger,
      workflowId: workflow.id,
      name: null,
    });
    expect(copy.ownerId).toBe(stranger.id);
    expect(copy.name).toBe('Orders (copy)');
    expect(workflows.workflows.get(copy.id)).toBe(copy);
  });

  it('ownership_moves_only_to_an_active_editor_or_administrator', async () => {
    const { workflow, workflows } = withDraft();
    const users = new InMemoryUserRepository(owner, stranger, viewer);
    const transfer = new TransferWorkflow(workflows, users, policy);
    await expect(
      transfer.execute({
        actor: owner,
        workflowId: workflow.id,
        ownerId: viewer.id,
      }),
    ).rejects.toBeInstanceOf(InvalidOwnerError);
    await expect(
      transfer.execute({
        actor: owner,
        workflowId: workflow.id,
        ownerId: 'nobody',
      }),
    ).rejects.toBeInstanceOf(InvalidOwnerError);
    await transfer.execute({
      actor: owner,
      workflowId: workflow.id,
      ownerId: stranger.id,
    });
    expect(workflow.ownerId).toBe(stranger.id);
  });

  it('a_sample_is_pinned_on_a_node_of_the_draft_and_unpinned_again', async () => {
    const { workflow, workflows } = withDraft();
    const samples = new InMemoryNodeSamples();
    await new PinSample(workflows, samples, policy).execute({
      actor: owner,
      workflowId: workflow.id,
      nodeId: 'a',
      items: [{ id: 1 }],
    });
    expect(workflow.pinnedNodeIds).toEqual(['a']);
    expect(await samples.pinned(workflow.id, 'a')).toEqual([{ id: 1 }]);
    await expect(
      new PinSample(workflows, samples, policy).execute({
        actor: owner,
        workflowId: workflow.id,
        nodeId: 'ghost',
        items: [],
      }),
    ).rejects.toBeInstanceOf(NodeNotFoundError);
    await new UnpinSample(workflows, samples, policy).execute({
      actor: owner,
      workflowId: workflow.id,
      nodeId: 'a',
    });
    expect(workflow.pinnedNodeIds).toEqual([]);
    expect(await samples.pinned(workflow.id, 'a')).toEqual([]);
  });
});
