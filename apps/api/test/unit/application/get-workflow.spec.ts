import type { WorkflowView } from '../../../src/application/interfaces.js';
import { WorkflowQueries } from '../../../src/application/interfaces.js';
import { WorkflowPolicy } from '../../../src/application/policies/workflow.policy.js';
import { ConfigurationCheck } from '../../../src/application/services/configuration-check.js';
import { GetWorkflow } from '../../../src/application/use-cases/get-workflow.js';
import { ProblemCode, Role } from '../../../src/domain/enums.js';
import { WorkflowNotFoundError } from '../../../src/domain/errors.js';
import { aNode, aTrigger, link } from '../../support/automation-builders.js';
import { FakeNodeTypeCatalog } from '../../support/automation-fakes.js';
import { aUser } from '../../support/builders.js';

const view: WorkflowView = {
  id: 'wf-1',
  name: 'Orders',
  owner: { id: 'owner-1', name: 'Owner' },
  archived: false,
  latestRelease: 0,
  activeRelease: null,
  updatedAt: new Date('2026-10-16T10:00:00.000Z'),
  revision: 2,
  graph: {
    nodes: [aTrigger('start'), aNode('a')],
    connections: [link('start', 'a')],
  },
  settings: { timezone: 'UTC', runTimeoutMs: 1_000, errorWorkflowId: null },
  samples: [],
};

class OneWorkflowQueries extends WorkflowQueries {
  list = () => Promise.resolve({ items: [], nextCursor: null });
  releases = () => Promise.resolve([]);
  release = () => Promise.reject(new Error('unused'));
  activeIds = () => Promise.resolve([]);
  get = (id: string) =>
    id === view.id
      ? Promise.resolve(view)
      : Promise.reject(new WorkflowNotFoundError());
}

describe('GetWorkflow', () => {
  const catalogue = new FakeNodeTypeCatalog().failing('a', {
    nodeId: 'a',
    parameter: 'value',
    code: ProblemCode.InvalidParameter,
    message: 'Required',
  });
  const getWorkflow = new GetWorkflow(
    new OneWorkflowQueries(),
    new ConfigurationCheck(catalogue),
    new WorkflowPolicy(),
  );

  it('any_user_reads_the_workflow_with_the_configuration_problems_of_its_draft', async () => {
    const details = await getWorkflow.execute({
      actor: aUser({ role: Role.Viewer }),
      workflowId: 'wf-1',
    });
    expect(details.workflow).toBe(view);
    expect(details.problems).toEqual([
      expect.objectContaining({
        nodeId: 'a',
        code: ProblemCode.InvalidParameter,
      }),
    ]);
    expect(details.canManage).toBe(false);
  });

  it('the_owner_is_told_that_they_may_manage_it', async () => {
    const details = await getWorkflow.execute({
      actor: aUser({ id: 'owner-1', role: Role.Editor }),
      workflowId: 'wf-1',
    });
    expect(details.canManage).toBe(true);
  });
});
