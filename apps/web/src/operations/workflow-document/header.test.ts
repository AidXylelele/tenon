import { describe, expect, it } from 'vitest';
import { headerOf } from './header';

describe('the header of a workflow', () => {
  it('reads_its_names_version_and_texts', () => {
    expect(
      headerOf({
        document: {
          namespace: 'sales',
          name: 'route-lead',
          version: '1.0.0',
          title: 'Route a lead',
          summary: 'To its owner.',
        },
      }),
    ).toEqual({
      namespace: 'sales',
      name: 'route-lead',
      version: '1.0.0',
      title: 'Route a lead',
      summary: 'To its owner.',
    });
  });

  it('a_part_that_is_missing_or_not_text_is_empty', () => {
    const empty = {
      namespace: '',
      name: '',
      version: '',
      title: '',
      summary: '',
    };

    expect(headerOf({})).toEqual(empty);
    expect(headerOf({ document: { name: 7 } })).toEqual(empty);
  });
});
