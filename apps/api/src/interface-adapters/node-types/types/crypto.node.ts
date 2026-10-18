import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  operation: z
    .enum(['hash', 'generate'])
    .default('hash')
    .meta({ title: 'Operation' }),
  algorithm: z
    .enum([
      'MD5',
      'SHA1',
      'SHA256',
      'SHA384',
      'SHA512',
      'SHA3-256',
      'SHA3-384',
      'SHA3-512',
    ])
    .default('SHA256')
    .meta({ title: 'Algorithm' }),
  value: z.string().default('').meta({ title: 'Value' }),
  encoding: z
    .enum(['hex', 'base64'])
    .default('hex')
    .meta({ title: 'Encoding' }),
  kind: z.enum(['uuid', 'random']).default('uuid').meta({ title: 'Generate' }),
  length: z
    .int()
    .min(1)
    .max(1024)
    .default(32)
    .meta({ title: 'Length in bytes' }),
  outputField: z
    .string()
    .min(1)
    .default('data')
    .meta({ title: 'Output field' }),
});

type CryptoParameters = z.infer<typeof parameters>;

export class CryptoNode implements NodeType<CryptoParameters> {
  readonly id = 'crypto';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Crypto';
  readonly description =
    'Hashes a value or generates a UUID or random bytes for each item';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['operation'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<CryptoParameters>): NodeResult {
    const results = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      const result =
        settings.operation === 'hash'
          ? this.digest(settings)
          : this.generated(settings);
      return new ItemPath(settings.outputField, true).write(item, result);
    });

    return { main: results };
  }

  private digest(settings: CryptoParameters): string {
    const algorithm = settings.algorithm.toLowerCase();
    return createHash(algorithm)
      .update(settings.value, 'utf8')
      .digest(settings.encoding);
  }

  private generated(settings: CryptoParameters): string {
    if (settings.kind === 'uuid') return randomUUID();

    return randomBytes(settings.length).toString(settings.encoding);
  }
}
