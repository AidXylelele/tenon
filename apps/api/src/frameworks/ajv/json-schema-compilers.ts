import { Ajv } from 'ajv';
import { Ajv2019 } from 'ajv/dist/2019.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import type { JsonSchemaCompilers } from '../../interface-adapters/json-schema/interfaces.js';

const OPTIONS = { allErrors: true, strict: false };

export function createJsonSchemaCompilers(): JsonSchemaCompilers {
  const draft07 = new Ajv(OPTIONS);
  const draft2019 = new Ajv2019(OPTIONS);
  const draft2020 = new Ajv2020(OPTIONS);
  ajvFormats.default(draft07);
  ajvFormats.default(draft2019);
  ajvFormats.default(draft2020);
  return { draft07, draft2019, draft2020 };
}
