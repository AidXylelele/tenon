import { marked } from 'marked';
import TurndownService from 'turndown';
import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  mode: z
    .enum(['markdownToHtml', 'htmlToMarkdown'])
    .default('markdownToHtml')
    .meta({ title: 'Mode' }),
  value: z.string().default('').meta({ title: 'Value' }),
  outputField: z
    .string()
    .min(1)
    .default('data')
    .meta({ title: 'Output field' }),
});

type MarkdownParameters = z.infer<typeof parameters>;

export class MarkdownNode implements NodeType<MarkdownParameters> {
  readonly id = 'markdown';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Markdown';
  readonly description = 'Converts Markdown to HTML or HTML to Markdown';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['mode'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<MarkdownParameters>): NodeResult {
    const converted = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      const result = this.converted(settings);
      return new ItemPath(settings.outputField, true).write(item, result);
    });

    return { main: converted };
  }

  private converted(settings: MarkdownParameters): string {
    if (settings.mode === 'markdownToHtml') {
      return marked.parse(settings.value, { async: false });
    }

    return new TurndownService().turndown(settings.value);
  }
}
