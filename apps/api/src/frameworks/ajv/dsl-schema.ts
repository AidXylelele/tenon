import { workflowSchema } from '@openworkflowspec/sdk';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import type { ParsedDocument } from '../../domain/automation/language/interfaces.js';
import type { DslSchema } from '../../interface-adapters/interfaces.js';

export function createDslSchema(): DslSchema {
  const compiler = new Ajv2020({ allErrors: true, strict: false });
  ajvFormats.default(compiler);
  const validate = compiler.compile<ParsedDocument>(workflowSchema);
  return { validate };
}
