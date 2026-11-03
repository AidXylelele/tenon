import { describe, expect, it } from 'vitest';
import { roleDuties, roleLabel, roleNoun } from './roles';

describe('the words of a role', () => {
  it.each([
    ['admin' as const, 'Administrator', 'an administrator'],
    ['editor' as const, 'Editor', 'an editor'],
    ['viewer' as const, 'Viewer', 'a viewer'],
  ])('%s_is_called_%s_and_in_a_sentence_%s', (role, label, noun) => {
    expect(roleLabel(role)).toBe(label);
    expect(roleNoun(role)).toBe(noun);
  });

  it('each_says_what_it_may_do', () => {
    expect(roleDuties('admin')).toBe(
      'everything editors do, and inviting people',
    );
    expect(roleDuties('editor')).toBe('builds, runs and connects automations');
    expect(roleDuties('viewer')).toBe('reads workflows and runs');
  });
});
