import type { ErrorObject } from 'ajv';
import {
  Classes,
  DslValidationError,
  SchemaValidationError,
} from '@openworkflowspec/sdk';

// What the SDK made of a document: its plain object, or a located failure.
export interface SdkReading {
  readonly plain: unknown;
  readonly pointer: string;
  readonly failure: string | null;
}

const YAML_ERROR = 'YAMLException';
const BRANCH_KEYWORDS = ['const', 'not', 'oneOf', 'anyOf'];

// Node loads this file in a worker thread as it is, so it keeps to erasable TypeScript and
// imports nothing of the platform. A document is read here because the SDK expands YAML
// aliases and validates on the thread it runs on: a small document can take minutes and
// gigabytes, which a terminated worker gives back.
export default function read(text: string): SdkReading {
  try {
    const hydrated = Classes.Workflow.deserialize(text);
    const plain: unknown = hydrated.asPlainObject();
    return { plain, pointer: '', failure: null };
  } catch (error) {
    if (error instanceof SchemaValidationError) return schemaFailure(error);

    if (error instanceof DslValidationError) return dslFailure(error);

    const unreadable = error instanceof Error && error.name === YAML_ERROR;

    if (unreadable) return yamlFailure(error);

    throw error;
  }
}

// The deepest error that does not only select a branch points at the defect.
function schemaFailure(error: SchemaValidationError): SdkReading {
  const located = error.schemaErrors.filter(
    (candidate) => !BRANCH_KEYWORDS.includes(candidate.keyword),
  );
  const deepestFirst = located.toSorted(
    (left, right) => depthOf(right) - depthOf(left),
  );
  const deepest = deepestFirst[0];
  const pointer = deepest?.instancePath ?? error.path;
  const failure = deepest?.message ?? error.name;
  return { plain: null, pointer, failure };
}

function depthOf(error: ErrorObject): number {
  const tokens = error.instancePath.split('/');
  return tokens.length;
}

function dslFailure(error: DslValidationError): SdkReading {
  const cause: unknown = error.cause;
  const failure = cause instanceof Error ? cause.message : error.message;
  return { plain: null, pointer: error.path, failure };
}

function yamlFailure(error: Error): SdkReading {
  const lines = error.message.split('\n');
  const failure = lines[0] ?? error.message;
  return { plain: null, pointer: '', failure };
}
