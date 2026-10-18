import { ProblemCode } from '../../../src/domain/enums.js';
import {
  NodeConfigurationError,
  NodeNotFoundError,
  ReleaseNotFoundError,
  ReleaseWithoutTriggerError,
  WorkflowArchivedError,
  WorkflowConflictError,
  WorkflowNotArchivedError,
} from '../../../src/domain/errors.js';
import { Graph } from '../../../src/domain/graph.js';
import type {
  Problem,
  WorkflowSettings,
} from '../../../src/domain/interfaces.js';
import { Workflow } from '../../../src/domain/workflow.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';

const settings: WorkflowSettings = {
  timezone: 'Europe/Kyiv',
  runTimeoutMs: 60_000,
  errorWorkflowId: null,
};

const problem: Problem = {
  nodeId: 'a',
  parameter: 'value',
  code: ProblemCode.InvalidParameter,
  message: 'The value is required',
};

const draftGraph = () =>
  aGraph([aTrigger('start'), aNode('a')], [link('start', 'a')]);

const aWorkflow = () => Workflow.create({ name: 'Orders', ownerId: 'owner-1' });

const withDraft = (graph: Graph = draftGraph()) => {
  const workflow = aWorkflow();
  workflow.saveDraft(1, graph, settings);
  return workflow;
};

describe('Workflow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a_new_workflow_has_an_empty_draft_at_revision_one_owned_by_its_creator', () => {
    const workflow = aWorkflow();
    expect(workflow.name).toBe('Orders');
    expect(workflow.ownerId).toBe('owner-1');
    expect(workflow.graph.nodes).toEqual([]);
    expect(workflow.revision).toBe(1);
    expect(workflow.settings).toEqual({
      timezone: 'UTC',
      runTimeoutMs: 3_600_000,
      errorWorkflowId: null,
    });
    expect(workflow.latestRelease).toBe(0);
    expect(workflow.activeRelease).toBeNull();
    expect(workflow.archivedAt).toBeNull();
  });

  it('renaming_changes_the_name_and_the_moment_of_the_last_change', () => {
    const workflow = aWorkflow();
    vi.setSystemTime(new Date('2026-10-16T11:00:00.000Z'));
    workflow.rename('Invoices');
    expect(workflow.name).toBe('Invoices');
    expect(workflow.updatedAt.toISOString()).toBe('2026-10-16T11:00:00.000Z');
  });

  it('saving_at_the_current_revision_replaces_the_draft_and_moves_to_the_next_revision', () => {
    const workflow = aWorkflow();
    const graph = draftGraph();
    workflow.saveDraft(1, graph, settings);
    expect(workflow.graph).toBe(graph);
    expect(workflow.settings).toEqual(settings);
    expect(workflow.revision).toBe(2);
  });

  it('saving_at_a_stale_revision_is_a_conflict_and_changes_nothing', () => {
    const workflow = withDraft();
    const before = workflow.graph;
    expect(() => workflow.saveDraft(1, Graph.empty(), settings)).toThrow(
      WorkflowConflictError,
    );
    expect(workflow.graph).toBe(before);
    expect(workflow.revision).toBe(2);
  });

  it('a_sample_is_pinned_only_on_a_node_of_the_draft', () => {
    const workflow = withDraft();
    workflow.pin('a');
    workflow.pin('a');
    expect(workflow.pinnedNodeIds).toEqual(['a']);
    expect(() => workflow.pin('ghost')).toThrow(NodeNotFoundError);
    workflow.unpin('a');
    expect(workflow.pinnedNodeIds).toEqual([]);
  });

  it('a_pin_goes_away_with_its_node_when_the_draft_is_saved', () => {
    const workflow = withDraft();
    workflow.pin('a');
    workflow.pin('start');
    workflow.saveDraft(2, aGraph([aTrigger('start')]), settings);
    expect(workflow.pinnedNodeIds).toEqual(['start']);
  });

  it('publishing_the_current_revision_creates_the_next_numbered_release', () => {
    const workflow = withDraft();
    const first = workflow.publish(2, [], 'owner-1');
    const second = workflow.publish(2, [], 'admin-1');
    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
    expect(second.workflowId).toBe(workflow.id);
    expect(second.graph).toBe(workflow.graph);
    expect(second.settings).toEqual(settings);
    expect(second.publishedBy).toBe('admin-1');
    expect(second.publishedAt.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    expect(workflow.latestRelease).toBe(2);
  });

  it('publishing_a_stale_revision_is_a_conflict', () => {
    const workflow = withDraft();
    expect(() => workflow.publish(1, [], 'owner-1')).toThrow(
      WorkflowConflictError,
    );
    expect(workflow.latestRelease).toBe(0);
  });

  it('a_draft_with_configuration_problems_is_not_published_and_every_problem_is_reported', () => {
    const workflow = withDraft();
    let refused: unknown;
    try {
      workflow.publish(2, [problem], 'owner-1');
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(NodeConfigurationError);
    expect((refused as NodeConfigurationError).problems).toEqual([problem]);
    expect(workflow.latestRelease).toBe(0);
  });

  it('activating_a_release_makes_it_the_only_active_one_and_records_the_change', () => {
    const workflow = withDraft();
    const first = workflow.publish(2, [], 'owner-1');
    const second = workflow.publish(2, [], 'owner-1');
    workflow.activate(first, []);
    workflow.activate(second, []);
    expect(workflow.activeRelease).toBe(2);
    expect(workflow.events).toEqual([
      { workflowId: workflow.id },
      { workflowId: workflow.id },
    ]);
    workflow.clearEvents();
    expect(workflow.events).toEqual([]);
  });

  it('a_release_of_another_workflow_cannot_be_activated', () => {
    const workflow = withDraft();
    const foreign = withDraft().publish(2, [], 'owner-1');
    expect(() => workflow.activate(foreign, [])).toThrow(ReleaseNotFoundError);
  });

  it('a_release_without_a_trigger_cannot_be_activated', () => {
    const workflow = withDraft(aGraph([aNode('a')]));
    const release = workflow.publish(2, [], 'owner-1');
    expect(() => workflow.activate(release, [])).toThrow(
      ReleaseWithoutTriggerError,
    );
    expect(workflow.activeRelease).toBeNull();
  });

  it('a_release_whose_credentials_no_longer_fit_is_not_activated', () => {
    const workflow = withDraft();
    const release = workflow.publish(2, [], 'owner-1');
    expect(() => workflow.activate(release, [problem])).toThrow(
      NodeConfigurationError,
    );
    expect(workflow.activeRelease).toBeNull();
  });

  it('deactivating_clears_the_active_release_and_records_the_change_once', () => {
    const workflow = withDraft();
    workflow.activate(workflow.publish(2, [], 'owner-1'), []);
    workflow.clearEvents();
    workflow.deactivate();
    workflow.deactivate();
    expect(workflow.activeRelease).toBeNull();
    expect(workflow.events).toHaveLength(1);
  });

  it('archiving_deactivates_and_an_archived_workflow_is_neither_activated_nor_archived_again', () => {
    const workflow = withDraft();
    const release = workflow.publish(2, [], 'owner-1');
    workflow.activate(release, []);
    workflow.clearEvents();
    workflow.archive();
    expect(workflow.archivedAt?.toISOString()).toBe('2026-10-16T10:00:00.000Z');
    expect(workflow.activeRelease).toBeNull();
    expect(workflow.events).toHaveLength(1);
    expect(() => workflow.activate(release, [])).toThrow(WorkflowArchivedError);
    expect(() => workflow.archive()).toThrow(WorkflowArchivedError);
  });

  it('restoring_brings_an_archived_workflow_back_and_refuses_one_that_is_not_archived', () => {
    const workflow = withDraft();
    expect(() => workflow.restore()).toThrow(WorkflowNotArchivedError);
    workflow.archive();
    workflow.restore();
    expect(workflow.archivedAt).toBeNull();
  });

  it('a_workflow_serves_only_its_active_release_while_it_is_not_archived', () => {
    const workflow = withDraft();
    workflow.activate(workflow.publish(2, [], 'owner-1'), []);
    expect(workflow.serves(1)).toBe(true);
    expect(workflow.serves(2)).toBe(false);
    workflow.archive();
    expect(workflow.serves(1)).toBe(false);
  });

  it('transferring_changes_the_owner', () => {
    const workflow = withDraft();
    workflow.transferTo('owner-2');
    expect(workflow.ownerId).toBe('owner-2');
  });

  it('a_copy_belongs_to_the_copier_and_keeps_only_the_credentials_the_copier_owns', () => {
    const workflow = withDraft(
      aGraph(
        [
          aTrigger('start'),
          aNode('mine', { credentialId: 'credential-mine' }),
          aNode('theirs', { credentialId: 'credential-theirs' }),
        ],
        [link('start', 'mine'), link('start', 'theirs')],
      ),
    );
    workflow.pin('mine');
    workflow.activate(workflow.publish(2, [], 'owner-1'), []);
    const copy = workflow.duplicate(
      'Orders (copy)',
      'editor-2',
      new Set(['credential-mine']),
    );
    expect(copy.id).not.toBe(workflow.id);
    expect(copy.name).toBe('Orders (copy)');
    expect(copy.ownerId).toBe('editor-2');
    expect(copy.graph.nodes.map((node) => node.credentialId)).toEqual([
      null,
      'credential-mine',
      null,
    ]);
    expect(copy.settings).toEqual(settings);
    expect(copy.revision).toBe(1);
    expect(copy.latestRelease).toBe(0);
    expect(copy.activeRelease).toBeNull();
    expect(copy.pinnedNodeIds).toEqual([]);
  });
});
