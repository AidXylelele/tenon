import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Piscina } from 'piscina';
import type { JqPool } from '../../interface-adapters/interfaces.js';

const extension = extname(fileURLToPath(import.meta.url));

const worker = new URL(
  `../../interface-adapters/expressions/jq.worker${extension}`,
  import.meta.url,
);

export function createJqPool(): JqPool {
  return new Piscina({ filename: worker.href, maxThreads: 4 });
}
