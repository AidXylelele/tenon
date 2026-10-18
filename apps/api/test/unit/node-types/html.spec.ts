import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { HtmlNode } from '../../../src/interface-adapters/node-types/types/html.node.js';
import { fixed, formula, runNode } from '../../support/node-runs.js';

const page = [
  '<h1 class="title">Pet <b>shop</b></h1>',
  '<ul><li><a href="/cat">Cat</a></li><li><a href="/dog">Dog</a></li></ul>',
  '<form><input name="q" value="kibble"></form>',
].join('');

const items = [{ id: 1, html: page }];

const html = (
  parameters: Record<string, unknown>,
  input: Record<string, unknown>[] = items,
) => runNode(new HtmlNode(), { items: input, parameters });

const extract = (extractions: Record<string, unknown>[]) =>
  html({ operation: fixed('extract'), extractions });

describe('HTML', () => {
  it('generates_the_template_of_each_item_into_the_html_field', async () => {
    const result = await html(
      { template: formula('<p>{{ $json.name }} costs {{ $json.price }}</p>') },
      [
        { name: 'kibble', price: 10 },
        { name: 'litter', price: 25 },
      ],
    );
    expect(result.main).toEqual([
      { name: 'kibble', price: 10, html: '<p>kibble costs 10</p>' },
      { name: 'litter', price: 25, html: '<p>litter costs 25</p>' },
    ]);
  });

  it('generates_into_the_chosen_output_field', async () => {
    const result = await html(
      {
        operation: fixed('generate'),
        template: fixed('<hr>'),
        outputField: fixed('mail.body'),
      },
      [{ id: 1 }],
    );
    expect(result.main).toEqual([{ id: 1, mail: { body: '<hr>' } }]);
  });

  it('extracts_the_text_of_the_first_match_into_the_item', async () => {
    const result = await extract([
      { key: fixed('title'), selector: fixed('h1') },
      {
        key: fixed('pet'),
        selector: fixed('li a'),
        returnValue: fixed('text'),
      },
    ]);
    expect(result.main).toEqual([
      { id: 1, html: page, title: 'Pet shop', pet: 'Cat' },
    ]);
  });

  it('extracts_the_inner_html_of_the_first_match', async () => {
    const result = await extract([
      {
        key: fixed('title'),
        selector: fixed('h1'),
        returnValue: fixed('html'),
      },
    ]);
    expect(result.main?.[0]?.title).toBe('Pet <b>shop</b>');
  });

  it('extracts_an_attribute_of_the_first_match', async () => {
    const result = await extract([
      {
        key: fixed('link'),
        selector: fixed('a'),
        returnValue: fixed('attribute'),
        attribute: fixed('href'),
      },
    ]);
    expect(result.main?.[0]?.link).toBe('/cat');
  });

  it('extracts_the_form_value_of_the_first_match', async () => {
    const result = await extract([
      {
        key: fixed('query'),
        selector: fixed('input[name=q]'),
        returnValue: fixed('value'),
      },
    ]);
    expect(result.main?.[0]?.query).toBe('kibble');
  });

  it('extracts_every_match_as_an_array', async () => {
    const result = await extract([
      { key: fixed('pets'), selector: fixed('a'), returnArray: fixed(true) },
      {
        key: fixed('links'),
        selector: fixed('a'),
        returnValue: fixed('attribute'),
        attribute: fixed('href'),
        returnArray: fixed(true),
      },
    ]);
    expect(result.main?.[0]).toMatchObject({
      pets: ['Cat', 'Dog'],
      links: ['/cat', '/dog'],
    });
  });

  it('an_extraction_without_a_match_is_null_or_an_empty_array', async () => {
    const result = await extract([
      { key: fixed('price'), selector: fixed('.price') },
      {
        key: fixed('missing'),
        selector: fixed('a'),
        returnValue: fixed('attribute'),
        attribute: fixed('title'),
      },
      {
        key: fixed('prices'),
        selector: fixed('.price'),
        returnArray: fixed(true),
      },
    ]);
    expect(result.main?.[0]).toMatchObject({
      price: null,
      missing: null,
      prices: [],
    });
  });

  it('reads_the_html_from_the_source_field_and_writes_keys_by_dot_path', async () => {
    const result = await html(
      {
        operation: fixed('extract'),
        sourceField: fixed('page.body'),
        extractions: [{ key: fixed('meta.title'), selector: fixed('h1') }],
      },
      [{ page: { body: '<h1>Hi</h1>' } }],
    );
    expect(result.main).toEqual([
      { page: { body: '<h1>Hi</h1>' }, meta: { title: 'Hi' } },
    ]);
  });

  it('does_not_change_the_input_items', async () => {
    const original = structuredClone(items);
    await extract([{ key: fixed('html'), selector: fixed('h1') }]);
    expect(items).toEqual(original);
  });

  it('an_attribute_extraction_without_an_attribute_fails_the_node_with_the_parameter', async () => {
    const run = extract([
      {
        key: fixed('link'),
        selector: fixed('a'),
        returnValue: fixed('attribute'),
      },
    ]);
    await expect(run).rejects.toBeInstanceOf(NodeUserError);
    await expect(run).rejects.toMatchObject({
      parameter: 'extractions.0.attribute',
      item: 0,
    });
  });

  it('an_invalid_selector_fails_the_node_with_the_parameter', async () => {
    await expect(
      extract([
        { key: fixed('title'), selector: fixed('h1') },
        { key: fixed('broken'), selector: fixed('div[') },
      ]),
    ).rejects.toMatchObject({ parameter: 'extractions.1.selector', item: 0 });
  });

  it('a_source_field_without_html_text_fails_the_node_with_the_parameter', async () => {
    await expect(
      html(
        {
          operation: fixed('extract'),
          extractions: [{ key: fixed('title'), selector: fixed('h1') }],
        },
        [{ html: '<h1>Hi</h1>' }, { body: '<h1>Hi</h1>' }],
      ),
    ).rejects.toMatchObject({ parameter: 'sourceField', item: 1 });
  });

  it('builds_one_table_from_all_items_with_the_union_of_their_keys', async () => {
    const result = await html({ operation: fixed('table') }, [
      { name: 'kibble', price: 10, stocked: true },
      { name: 'litter', tags: ['cat', 'dog'], price: null },
      { meta: { sku: 'T-1' } },
    ]);
    expect(result.main).toEqual([
      {
        html:
          '<table><thead><tr><th>name</th><th>price</th><th>stocked</th><th>tags</th><th>meta</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>kibble</td><td>10</td><td>true</td><td></td><td></td></tr>' +
          '<tr><td>litter</td><td></td><td></td><td>[&quot;cat&quot;,&quot;dog&quot;]</td><td></td></tr>' +
          '<tr><td></td><td></td><td></td><td></td><td>{&quot;sku&quot;:&quot;T-1&quot;}</td></tr>' +
          '</tbody></table>',
      },
    ]);
  });

  it('escapes_every_header_and_cell_of_the_table', async () => {
    const result = await html({ operation: fixed('table') }, [
      { '<b>': `<script>alert("x")</script> & 'y'` },
    ]);
    expect(result.main).toEqual([
      {
        html:
          '<table><thead><tr><th>&lt;b&gt;</th></tr></thead>' +
          '<tbody><tr><td>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;</td></tr></tbody></table>',
      },
    ]);
  });

  it('writes_the_table_into_the_chosen_output_field', async () => {
    const result = await html(
      { operation: fixed('table'), outputField: fixed('report') },
      [{ a: 1 }],
    );
    expect(result.main).toEqual([
      {
        report:
          '<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>',
      },
    ]);
  });

  it('a_table_of_no_items_outputs_no_items', async () => {
    const result = await html({ operation: fixed('table') }, []);
    expect(result.main).toEqual([]);
  });

  it('accepts_only_a_fixed_operation', () => {
    expect(new HtmlNode().fixedParameters).toEqual(['operation']);
  });
});
