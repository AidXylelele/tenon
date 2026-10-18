import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  mode: z
    .enum(['jsonToXml', 'xmlToJson'])
    .default('xmlToJson')
    .meta({ title: 'Mode' }),
  field: z.string().min(1).default('data').meta({ title: 'XML field' }),
  rootName: z
    .string()
    .regex(/^[A-Za-z_][\w.:-]*$/, 'The root name must be an XML element name')
    .default('root')
    .meta({ title: 'Root element' }),
  outputField: z
    .string()
    .min(1)
    .default('data')
    .meta({ title: 'Output field' }),
});

type XmlParameters = z.infer<typeof parameters>;

export class XmlNode implements NodeType<XmlParameters> {
  readonly id = 'xml';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'XML';
  readonly description = 'Converts XML text to JSON or an item to XML text';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['mode'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<XmlParameters>): NodeResult {
    const converted = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      const result =
        settings.mode === 'xmlToJson'
          ? this.json(item, settings.field, index)
          : this.xml(item, settings);
      return new ItemPath(settings.outputField, true).write(item, result);
    });

    return { main: converted };
  }

  private json(item: Item, field: string, index: number): unknown {
    const text = new ItemPath(field, true).read(item);

    if (typeof text !== 'string') {
      throw new NodeUserError(
        `field: the field ${field} does not hold XML text`,
        'field',
        index,
      );
    }

    const validation = XMLValidator.validate(text);

    if (validation !== true) {
      throw new NodeUserError(
        `field: the XML is not valid: ${validation.err.msg}`,
        'field',
        index,
      );
    }

    const parser = new XMLParser({
      processEntities: false,
      ignoreAttributes: false,
    });
    const parsed: unknown = parser.parse(text);
    return parsed;
  }

  private xml(item: Item, settings: XmlParameters): string {
    const data = new ItemPath(settings.outputField, true).remove(item);
    const builder = new XMLBuilder({ ignoreAttributes: false });
    const xml: string = builder.build({ [settings.rootName]: data });
    return xml;
  }
}
