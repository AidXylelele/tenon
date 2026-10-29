import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { Ajv, ValidateFunction } from 'ajv';
import type { Ajv2019 } from 'ajv/dist/2019.js';
import type { Ajv2020 } from 'ajv/dist/2020.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ParsedDocument } from '../domain/automation/language/interfaces.js';
import { Piscina } from 'piscina';
import { Dispatcher, Pool } from 'undici';
import type * as schema from './persistence/schema/index.js';

export abstract class Database extends NodePgDatabase<typeof schema> {}

export type DrizzleTx = TransactionalAdapterDrizzleOrm<Database>;

export abstract class EndpointDispatcher extends Dispatcher {}

export abstract class SandboxPool extends Pool {}

export abstract class JsonSchemaCompilers {
  abstract readonly draft07: Ajv;
  abstract readonly draft2019: Ajv2019;
  abstract readonly draft2020: Ajv2020;
}

export abstract class DslSchema {
  abstract readonly validate: ValidateFunction<ParsedDocument>;
}

export interface JqTask {
  readonly program: string;
  readonly input: string;
  readonly arguments: Readonly<Record<string, string>>;
}

export interface JqValues {
  readonly values: readonly unknown[];
}

export interface JqFailure {
  readonly failure: string;
}

export type JqOutcome = JqValues | JqFailure;

export abstract class JqPool extends Piscina<JqTask, JqOutcome> {}
