import { Release } from '../../../src/domain/release.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';

const aRelease = (graph = aGraph([aTrigger('start')])) =>
  new Release({
    workflowId: 'workflow-1',
    number: 3,
    graph,
    settings: { timezone: 'UTC', runTimeoutMs: 1_000, errorWorkflowId: null },
    publishedAt: new Date('2026-10-16T10:00:00.000Z'),
    publishedBy: 'owner-1',
  });

describe('Release', () => {
  it('a_release_with_a_trigger_node_has_a_trigger', () => {
    expect(aRelease().hasTrigger).toBe(true);
    expect(aRelease(aGraph([aNode('a')])).hasTrigger).toBe(false);
  });

  it('a_disabled_trigger_does_not_count', () => {
    expect(
      aRelease(aGraph([aTrigger('start', { disabled: true }), aNode('a')]))
        .hasTrigger,
    ).toBe(false);
  });

  it('a_release_lists_the_credentials_its_nodes_use_once_each', () => {
    const release = aRelease(
      aGraph(
        [
          aTrigger('start'),
          aNode('a', { credentialId: 'c-1' }),
          aNode('b', { credentialId: 'c-1' }),
        ],
        [link('start', 'a'), link('a', 'b')],
      ),
    );
    expect(release.credentialIds).toEqual(['c-1']);
  });
});
