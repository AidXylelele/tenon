import { MarkdownNode } from '../../../src/interface-adapters/node-types/types/markdown.node.js';
import { field, fixed, runNode } from '../../support/node-runs.js';

const markdown = (
  parameters: Record<string, unknown>,
  items: Record<string, unknown>[],
) => runNode(new MarkdownNode(), { items, parameters });

describe('Markdown', () => {
  it('converts_the_markdown_of_each_item_to_html_into_the_data_field', async () => {
    const result = await markdown({ value: field('text') }, [
      { text: '# Shop\n\n**kibble** and _litter_' },
      { text: 'Just *cats*' },
    ]);
    expect(result.main).toEqual([
      {
        text: '# Shop\n\n**kibble** and _litter_',
        data: '<h1>Shop</h1>\n<p><strong>kibble</strong> and <em>litter</em></p>\n',
      },
      { text: 'Just *cats*', data: '<p>Just <em>cats</em></p>\n' },
    ]);
  });

  it('converts_html_to_markdown', async () => {
    const result = await markdown(
      { mode: fixed('htmlToMarkdown'), value: field('html') },
      [
        {
          html: '<h1>Shop</h1><p><strong>kibble</strong> and <em>litter</em></p>',
        },
      ],
    );
    expect(result.main?.[0]?.data).toBe(
      'Shop\n====\n\n**kibble** and _litter_',
    );
  });

  it('writes_into_the_chosen_output_field_by_dot_path_and_keeps_the_item', async () => {
    const result = await markdown(
      { value: fixed('*hi*'), outputField: fixed('mail.body') },
      [{ id: 1 }],
    );
    expect(result.main).toEqual([
      { id: 1, mail: { body: '<p><em>hi</em></p>\n' } },
    ]);
  });

  it('an_empty_value_converts_to_empty_text_in_both_modes', async () => {
    expect((await markdown({}, [{}])).main).toEqual([{ data: '' }]);
    expect(
      (await markdown({ mode: fixed('htmlToMarkdown') }, [{}])).main,
    ).toEqual([{ data: '' }]);
  });

  it('accepts_only_a_fixed_mode', () => {
    expect(new MarkdownNode().fixedParameters).toEqual(['mode']);
  });
});
