import { Injectable } from '@nestjs/common';
import type { ErrorObject } from 'ajv';
import {
  Classes,
  DslValidationError,
  SchemaValidationError,
} from '@openworkflowspec/sdk';
import type { JsonObject } from '../../domain/automation/language/interfaces.js';
import { DslOutcomeKind } from '../../interface-adapters/workflows/definitions/enums.js';
import type * as Dsl from '../../interface-adapters/workflows/definitions/interfaces.js';
import {
  type DslFailure,
  type DslOutcome,
  OpenWorkflowClient,
} from '../../interface-adapters/workflows/definitions/interfaces.js';

@Injectable()
export class SdkOpenWorkflowClient implements OpenWorkflowClient {
  private static readonly YAML_ERROR = 'YAMLException';
  private static readonly BRANCH_KEYWORDS = ['const', 'not', 'oneOf', 'anyOf'];

  parse(text: string): DslOutcome {
    try {
      const hydrated = Classes.Workflow.deserialize(text);
      const plain: unknown = hydrated.asPlainObject();
      const workflow = plain as Dsl.Workflow;
      const document = plain as JsonObject;
      return { kind: DslOutcomeKind.Parsed, workflow, document };
    } catch (error) {
      if (error instanceof SchemaValidationError)
        return this.#schemaFailure(error);

      if (error instanceof DslValidationError) return this.#dslFailure(error);

      const unreadable =
        error instanceof Error &&
        error.name === SdkOpenWorkflowClient.YAML_ERROR;

      if (unreadable) return this.#yamlFailure(error);

      throw error;
    }
  }

  #schemaFailure(error: SchemaValidationError): DslFailure {
    const located = error.schemaErrors.filter(
      (candidate) =>
        !SdkOpenWorkflowClient.BRANCH_KEYWORDS.includes(candidate.keyword),
    );
    const deepestFirst = located.toSorted(
      (left, right) => this.#depth(right) - this.#depth(left),
    );
    const deepest = deepestFirst[0];
    const pointer = deepest?.instancePath ?? error.path;
    const failure = deepest?.message ?? error.name;
    return { kind: DslOutcomeKind.Failure, pointer, failure };
  }

  #depth(error: ErrorObject): number {
    const tokens = error.instancePath.split('/');
    return tokens.length;
  }

  #dslFailure(error: DslValidationError): DslFailure {
    const cause: unknown = error.cause;
    const failure = cause instanceof Error ? cause.message : error.message;
    return { kind: DslOutcomeKind.Failure, pointer: error.path, failure };
  }

  #yamlFailure(error: Error): DslFailure {
    const lines = error.message.split('\n');
    const failure = lines[0] ?? error.message;
    return { kind: DslOutcomeKind.Failure, pointer: '', failure };
  }
}
