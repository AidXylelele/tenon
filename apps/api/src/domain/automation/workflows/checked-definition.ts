import type { JsonObject } from '../json.js';
import type { CheckedDefinitionProps } from './interfaces.js';
import type { WorkflowName } from './workflow-name.js';

// A document the runtime accepted: its identity and a fingerprint of its content. Only the
// checker makes one.
export class CheckedDefinition {
  readonly #name: WorkflowName;
  readonly #version: string;
  readonly #dsl: string;
  readonly #fingerprint: string;
  readonly #document: JsonObject;
  readonly #eventTypes: readonly string[] | null;

  constructor(props: CheckedDefinitionProps) {
    this.#name = props.name;
    this.#version = props.version;
    this.#dsl = props.dsl;
    this.#fingerprint = props.fingerprint;
    this.#document = props.document;
    this.#eventTypes = props.eventTypes;
  }

  get name(): WorkflowName {
    return this.#name;
  }

  get version(): string {
    return this.#version;
  }

  get dsl(): string {
    return this.#dsl;
  }

  get fingerprint(): string {
    return this.#fingerprint;
  }

  get document(): JsonObject {
    return this.#document;
  }

  get eventTypes(): readonly string[] | null {
    return this.#eventTypes;
  }
}
