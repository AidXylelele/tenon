import type { Ajv } from 'ajv';
import type { Ajv2019 } from 'ajv/dist/2019.js';
import type { Ajv2020 } from 'ajv/dist/2020.js';

export abstract class JsonSchemaCompilers {
  abstract readonly draft07: Ajv;
  abstract readonly draft2019: Ajv2019;
  abstract readonly draft2020: Ajv2020;
}
