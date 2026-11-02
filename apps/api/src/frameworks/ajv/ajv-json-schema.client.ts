import { Injectable } from '@nestjs/common';
import { Ajv, type Options, type ValidateFunction } from 'ajv';
import { Ajv2019 } from 'ajv/dist/2019.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import type {
  JsonObject,
  JsonValue,
} from '../../domain/automation/language/interfaces.js';
import { JsonSchemaOutcomeKind } from '../../interface-adapters/workflows/schemas/enums.js';
import {
  JsonSchemaClient,
  type JsonSchemaCompilation,
  type JsonSchemaVerdict,
} from '../../interface-adapters/workflows/schemas/interfaces.js';

interface CompiledSchema {
  readonly compiler: Ajv | Ajv2019 | Ajv2020;
  readonly schema: JsonObject;
  readonly validate: ValidateFunction | null;
  readonly failure: string;
}

@Injectable()
export class AjvJsonSchemaClient implements JsonSchemaClient {
  private static readonly DRAFT_2019 =
    'https://json-schema.org/draft/2019-09/schema';
  private static readonly DRAFT_2020 =
    'https://json-schema.org/draft/2020-12/schema';
  private static readonly CACHED = 256;
  // A schema with an `$id` compiles again instead of failing as a duplicate.
  private static readonly OPTIONS: Options = {
    allErrors: true,
    strict: false,
    addUsedSchema: false,
  };

  private readonly draft07 = new Ajv(AjvJsonSchemaClient.OPTIONS);
  private readonly draft2019 = new Ajv2019(AjvJsonSchemaClient.OPTIONS);
  private readonly draft2020 = new Ajv2020(AjvJsonSchemaClient.OPTIONS);
  private readonly compiled = new Map<string, CompiledSchema>();

  constructor() {
    ajvFormats.default(this.draft07);
    ajvFormats.default(this.draft2019);
    ajvFormats.default(this.draft2020);
  }

  compile(schema: JsonObject): JsonSchemaCompilation {
    const compiled = this.#compiled(schema);

    if (compiled.validate === null)
      return { kind: JsonSchemaOutcomeKind.Unusable, reason: compiled.failure };

    return { kind: JsonSchemaOutcomeKind.Compiled };
  }

  validate(schema: JsonObject, data: JsonValue): JsonSchemaVerdict {
    const compiled = this.#compiled(schema);
    const validate = compiled.validate;

    if (validate === null)
      return { kind: JsonSchemaOutcomeKind.Unusable, reason: compiled.failure };

    const valid = validate(data);

    if (valid) return { kind: JsonSchemaOutcomeKind.Valid };

    const reason = this.draft07.errorsText(validate.errors, {
      dataVar: 'value',
    });
    return { kind: JsonSchemaOutcomeKind.Invalid, reason };
  }

  // Ajv keeps every schema it compiled, so an entry that leaves the cache leaves Ajv too.
  #compiled(schema: JsonObject): CompiledSchema {
    const key = JSON.stringify(schema);
    const cached = this.compiled.get(key);

    if (cached !== undefined) {
      this.compiled.delete(key);
      this.compiled.set(key, cached);
      return cached;
    }

    const compiler = this.#compilerFor(schema);
    const compiled = this.#compile(compiler, schema);
    this.compiled.set(key, compiled);

    if (this.compiled.size > AjvJsonSchemaClient.CACHED) this.#evictOldest();

    return compiled;
  }

  #compile(
    compiler: Ajv | Ajv2019 | Ajv2020,
    schema: JsonObject,
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

  #evictOldest(): void {
    const [oldest] = this.compiled.entries();

    if (oldest === undefined) return;

    const [key, entry] = oldest;
    this.compiled.delete(key);
    entry.compiler.removeSchema(entry.schema);
  }

  #compilerFor(schema: JsonObject): Ajv | Ajv2019 | Ajv2020 {
    const dialect = schema.$schema;

    if (typeof dialect !== 'string') return this.draft07;

    if (dialect.startsWith(AjvJsonSchemaClient.DRAFT_2020))
      return this.draft2020;

    if (dialect.startsWith(AjvJsonSchemaClient.DRAFT_2019))
      return this.draft2019;

    return this.draft07;
  }
}
