import { type CheerioAPI, load } from 'cheerio';
import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const extraction = z
  .strictObject({
    key: z.string().min(1).meta({ title: 'Key' }),
    selector: z.string().min(1).meta({ title: 'CSS selector' }),
    returnValue: z
      .enum(['text', 'html', 'attribute', 'value'])
      .default('text')
      .meta({ title: 'Return value' }),
    attribute: z.string().min(1).optional().meta({ title: 'Attribute' }),
    returnArray: z
      .boolean()
      .default(false)
      .meta({ title: 'Return all matches' }),
  })
  .superRefine((value, context) => {
    if (value.returnValue !== 'attribute') return;

    if (value.attribute !== undefined) return;

    context.addIssue({
      code: 'custom',
      path: ['attribute'],
      message: 'An attribute name is required to return an attribute',
    });
  });

const parameters = z.strictObject({
  operation: z
    .enum(['generate', 'extract', 'table'])
    .default('generate')
    .meta({ title: 'Operation' }),
  template: z.string().default('').meta({ title: 'HTML template' }),
  sourceField: z.string().min(1).default('html').meta({ title: 'HTML field' }),
  extractions: z
    .array(extraction)
    .default([])
    .meta({ title: 'Values to extract' }),
  outputField: z
    .string()
    .min(1)
    .default('html')
    .meta({ title: 'Output field' }),
});

type HtmlParameters = z.infer<typeof parameters>;

type Extraction = z.infer<typeof extraction>;

type Selection = ReturnType<CheerioAPI>;

type ExtractedValue = string | string[] | null;

export class HtmlNode implements NodeType<HtmlParameters> {
  readonly id = 'html';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'HTML';
  readonly description =
    'Generates HTML from a template, extracts values by CSS selectors or builds a table of all items';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['operation'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<HtmlParameters>): NodeResult {
    if (run.items.length === 0) return { main: [] };

    const { operation, outputField } = run.parameters();

    if (operation === 'table') {
      return { main: [this.table(run.items, outputField)] };
    }

    const results = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      return settings.operation === 'extract'
        ? this.extracted(item, settings, index)
        : this.generated(item, settings);
    });

    return { main: results };
  }

  private generated(item: Item, settings: HtmlParameters): Item {
    return new ItemPath(settings.outputField, true).write(
      item,
      settings.template,
    );
  }

  private extracted(item: Item, settings: HtmlParameters, index: number): Item {
    const html = this.source(item, settings.sourceField, index);
    const document = load(html);
    let result = item;

    for (const [position, extraction] of settings.extractions.entries()) {
      const matches = this.matches(document, extraction, position, index);
      const value = extraction.returnArray
        ? this.every(document, matches, extraction)
        : this.first(matches, extraction);
      result = new ItemPath(extraction.key, true).write(result, value);
    }

    return result;
  }

  private source(item: Item, sourceField: string, index: number): string {
    const html = new ItemPath(sourceField, true).read(item);

    if (typeof html !== 'string') {
      throw new NodeUserError(
        `sourceField: the field ${sourceField} does not hold HTML text`,
        'sourceField',
        index,
      );
    }

    return html;
  }

  private matches(
    document: CheerioAPI,
    extraction: Extraction,
    position: number,
    index: number,
  ): Selection {
    try {
      return document(extraction.selector);
    } catch (error) {
      const parameter = `extractions.${position}.selector`;
      const reason = error instanceof Error ? error.message : String(error);
      throw new NodeUserError(
        `${parameter}: the CSS selector is not valid: ${reason}`,
        parameter,
        index,
      );
    }
  }

  private every(
    document: CheerioAPI,
    matches: Selection,
    extraction: Extraction,
  ): ExtractedValue[] {
    return matches.toArray().map((element) => {
      const match = document(element);
      return this.valueOf(match, extraction);
    });
  }

  private first(matches: Selection, extraction: Extraction): ExtractedValue {
    if (matches.length === 0) return null;

    const match = matches.first();
    return this.valueOf(match, extraction);
  }

  private valueOf(match: Selection, extraction: Extraction): ExtractedValue {
    switch (extraction.returnValue) {
      case 'text':
        return match.text();
      case 'html':
        return match.html();
      case 'attribute':
        return match.attr(extraction.attribute!) ?? null;
      default:
        return match.val() ?? null;
    }
  }

  private table(items: readonly Item[], outputField: string): Item {
    const columns = this.columns(items);
    let body = '';

    for (const item of items) {
      body += this.row(item, columns);
    }

    const html = `<table><thead>${this.header(columns)}</thead><tbody>${body}</tbody></table>`;
    return new ItemPath(outputField, true).write({}, html);
  }

  private columns(items: readonly Item[]): string[] {
    const columns = new Set<string>();

    for (const item of items) {
      for (const key of Object.keys(item)) {
        columns.add(key);
      }
    }

    return Array.from(columns);
  }

  private header(columns: readonly string[]): string {
    let cells = '';

    for (const column of columns) {
      cells += `<th>${this.escaped(column)}</th>`;
    }

    return `<tr>${cells}</tr>`;
  }

  private row(item: Item, columns: readonly string[]): string {
    let cells = '';

    for (const column of columns) {
      const value = new ItemPath(column, false).read(item);
      const text = this.textOf(value);
      cells += `<td>${this.escaped(text)}</td>`;
    }

    return `<tr>${cells}</tr>`;
  }

  private textOf(value: unknown): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private escaped(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
