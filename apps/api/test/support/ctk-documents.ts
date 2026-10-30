import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const features = fileURLToPath(
  new URL('../conformance/features', import.meta.url),
);

const DOCUMENT = /"""yaml\n([\s\S]*?)\n\s*"""/;

const INDENT = /^(\s*)/;

export function ctkDocuments(): string[] {
  const documents: string[] = [];
  const files = readdirSync(features).filter((name) =>
    name.endsWith('.feature'),
  );

  for (const file of files) {
    const text = readFileSync(`${features}/${file}`, 'utf8');
    const blocks = text.split('Given a workflow with definition:').slice(1);

    for (const block of blocks) {
      const yaml = DOCUMENT.exec(block)?.[1] ?? '';
      const indent = INDENT.exec(yaml)?.[1]?.length ?? 0;
      const lines = yaml.split('\n').map((line) => line.slice(indent));
      documents.push(lines.join('\n'));
    }
  }

  return documents;
}
