import { Ajv, type Options, type ValidateFunction } from 'ajv';
import { Ajv2019 } from 'ajv/dist/2019.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';

// A schema to compile, and the data to validate against it unless `data` is absent.
export interface AjvTask {
  readonly schema: Record<string, unknown>;
  readonly validates: boolean;
  readonly data: unknown;
}

// `unusable`: Ajv could not compile the schema; `reason`: why, or why the data does not match.
export interface AjvAnswer {
  readonly unusable: boolean;
  readonly valid: boolean;
  readonly reason: string;
}

interface CompiledSchema {
  readonly compiler: Ajv | Ajv2019 | Ajv2020;
  readonly schema: Record<string, unknown>;
  readonly validate: ValidateFunction | null;
  readonly failure: string;
}

const DRAFT_2019 = 'https://json-schema.org/draft/2019-09/schema';
const DRAFT_2020 = 'https://json-schema.org/draft/2020-12/schema';
const CACHED = 256;
// A schema with an `$id` compiles again instead of failing as a duplicate. Ajv reports the
// first error only: its security notes advise against `allErrors` for untrusted schemas.
const OPTIONS: Options = { strict: false, addUsedSchema: false };

const draft07 = new Ajv(OPTIONS);
const draft2019 = new Ajv2019(OPTIONS);
const draft2020 = new Ajv2020(OPTIONS);
const compiled = new Map<string, CompiledSchema>();

ajvFormats.default(draft07);
ajvFormats.default(draft2019);
ajvFormats.default(draft2020);

// Node loads this file in a worker thread as it is, so it keeps to erasable TypeScript and
// imports nothing of the platform. Author schemas run here because Ajv trusts its schemas: a
// `pattern` can backtrack for ever, and only terminating the thread stops it.
export default function run(task: AjvTask): AjvAnswer {
  const entry = compiledOf(task.schema);
  const validate = entry.validate;

  if (validate === null)
    return { unusable: true, valid: false, reason: entry.failure };

  if (!task.validates) return { unusable: false, valid: true, reason: '' };

  const valid = validate(task.data);

  if (valid) return { unusable: false, valid: true, reason: '' };

  const reason = draft07.errorsText(validate.errors, { dataVar: 'value' });
  return { unusable: false, valid: false, reason };
}

// Ajv keeps every schema it compiled, so an entry that leaves the cache leaves Ajv too.
function compiledOf(schema: Record<string, unknown>): CompiledSchema {
  const key = JSON.stringify(schema);
  const cached = compiled.get(key);

  if (cached !== undefined) {
    compiled.delete(key);
    compiled.set(key, cached);
    return cached;
  }

  const compiler = compilerFor(schema);
  const entry = compile(compiler, schema);
  compiled.set(key, entry);

  if (compiled.size > CACHED) evictOldest();

  return entry;
}

function compile(
  compiler: Ajv | Ajv2019 | Ajv2020,
  schema: Record<string, unknown>,
): CompiledSchema {
  try {
    const validate = compiler.compile(schema);
    return { compiler, schema, validate, failure: '' };
  } catch (error) {
    compiler.removeSchema(schema);
    const failure = error instanceof Error ? error.message : String(error);
    return { compiler, schema, validate: null, failure };
  }
}

function evictOldest(): void {
  const [oldest] = compiled.entries();

  if (oldest === undefined) return;

  const [key, entry] = oldest;
  compiled.delete(key);
  entry.compiler.removeSchema(entry.schema);
}

function compilerFor(schema: Record<string, unknown>): Ajv | Ajv2019 | Ajv2020 {
  const dialect = schema.$schema;

  if (typeof dialect !== 'string') return draft07;

  if (dialect.startsWith(DRAFT_2020)) return draft2020;

  if (dialect.startsWith(DRAFT_2019)) return draft2019;

  return draft07;
}
