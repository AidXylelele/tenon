import { describe, expect, it } from 'vitest';
import { draftFrom, headerOf, nextVersion } from './draft';

describe('a draft of a version', () => {
  it('proposes_the_next_patch_version', () => {
    expect(nextVersion('1.2.3')).toBe('1.2.4');
    expect(nextVersion('2.0.0-beta.1')).toBe('2.0.1');
    expect(nextVersion('not a version')).toBe('1.0.0');
  });

  it('keeps_the_document_and_moves_only_its_version', () => {
    const draft = draftFrom({
      document: { dsl: '1.0.3', namespace: 'a', name: 'b', version: '1.0.9' },
      do: [],
    });

    expect(headerOf(draft)).toMatchObject({
      namespace: 'a',
      name: 'b',
      version: '1.0.10',
    });
  });
});
