import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { XmlNode } from '../../../src/interface-adapters/node-types/types/xml.node.js';
import { fixed, runNode } from '../../support/node-runs.js';

const xml = (
  parameters: Record<string, unknown>,
  items: Record<string, unknown>[],
) => runNode(new XmlNode(), { items, parameters });

describe('XML', () => {
  it('converts_the_xml_text_of_the_data_field_into_json_with_attributes', async () => {
    const result = await xml({}, [
      {
        id: 1,
        data: '<order id="7"><item>kibble</item><price>10</price></order>',
      },
    ]);
    expect(result.main).toEqual([
      { id: 1, data: { order: { item: 'kibble', price: 10, '@_id': '7' } } },
    ]);
  });

  it('does_not_expand_entities', async () => {
    const result = await xml({ mode: fixed('xmlToJson') }, [
      { data: '<note>cats &amp; dogs</note>' },
      { data: '<!DOCTYPE r [<!ENTITY x "boom">]><r>&x;</r>' },
    ]);
    expect(result.main).toEqual([
      { data: { note: 'cats &amp; dogs' } },
      { data: { r: '&x;' } },
    ]);
  });

  it('reads_the_chosen_field_and_writes_into_the_output_field', async () => {
    const result = await xml(
      { field: fixed('payload.body'), outputField: fixed('parsed') },
      [{ payload: { body: '<pet>cat</pet>' } }],
    );
    expect(result.main).toEqual([
      { payload: { body: '<pet>cat</pet>' }, parsed: { pet: 'cat' } },
    ]);
  });

  it('a_missing_xml_text_fails_the_node_with_the_field_parameter', async () => {
    const run = xml({}, [{ body: '<pet>cat</pet>' }]);
    await expect(run).rejects.toBeInstanceOf(NodeUserError);
    await expect(run).rejects.toMatchObject({ parameter: 'field', item: 0 });
  });

  it('unparsable_xml_fails_the_node_with_the_field_parameter', async () => {
    await expect(
      xml({}, [{ data: '<pet>cat</pet>' }, { data: '<order><item>' }]),
    ).rejects.toMatchObject({ parameter: 'field', item: 1 });
    await expect(xml({}, [{ data: 'not xml' }])).rejects.toMatchObject({
      parameter: 'field',
      item: 0,
    });
  });

  it('converts_the_item_into_escaped_xml_under_the_root_name', async () => {
    const result = await xml({ mode: fixed('jsonToXml') }, [
      {
        name: 'kibble & <co>',
        price: 10,
        meta: { '@_sku': 'K-1', stock: 3 },
      },
    ]);
    expect(result.main).toEqual([
      {
        name: 'kibble & <co>',
        price: 10,
        meta: { '@_sku': 'K-1', stock: 3 },
        data:
          '<root><name>kibble &amp; &lt;co&gt;</name><price>10</price>' +
          '<meta sku="K-1"><stock>3</stock></meta></root>',
      },
    ]);
  });

  it('leaves_the_output_field_out_of_the_xml_and_uses_the_chosen_root_name', async () => {
    const result = await xml(
      { mode: fixed('jsonToXml'), rootName: fixed('order') },
      [{ item: 'kibble', data: 'previous' }],
    );
    expect(result.main).toEqual([
      { item: 'kibble', data: '<order><item>kibble</item></order>' },
    ]);
  });

  it('a_root_name_that_is_not_an_xml_name_fails_the_node_with_the_parameter', async () => {
    await expect(
      xml({ mode: fixed('jsonToXml'), rootName: fixed('my order') }, [{}]),
    ).rejects.toMatchObject({ parameter: 'rootName', item: 0 });
  });

  it('accepts_only_a_fixed_mode', () => {
    expect(new XmlNode().fixedParameters).toEqual(['mode']);
  });
});
