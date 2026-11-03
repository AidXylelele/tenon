import { randomUUID } from 'node:crypto';
import type { Result } from '../../result.js';
import type { JsonObject } from '../json.js';
import type { CheckedDefinition } from './checked-definition.js';
import { WorkflowRefusal } from './enums.js';
import type {
  NewPublication,
  Publication,
  WorkflowVersionProps,
} from './interfaces.js';

export class WorkflowVersion {
  readonly #id: string;
  readonly #workflowId: string;
  readonly #semver: string;
  readonly #dsl: string;
  readonly #fingerprint: string;
  readonly #document: JsonObject;
  readonly #publisherId: string;
  readonly #publishedAt: Date;

  constructor(props: WorkflowVersionProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#semver = props.semver;
    this.#dsl = props.dsl;
    this.#fingerprint = props.fingerprint;
    this.#document = props.document;
    this.#publisherId = props.publisherId;
    this.#publishedAt = props.publishedAt;
  }

  static publish(workflowId: string, input: NewPublication): WorkflowVersion {
    const definition = input.definition;
    const id = randomUUID();
    return new WorkflowVersion({
      id,
      workflowId,
      semver: definition.version,
      dsl: definition.dsl,
      fingerprint: definition.fingerprint,
      document: definition.document,
      publisherId: input.publisherId,
      publishedAt: input.now,
    });
  }

  get id(): string {
    return this.#id;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get semver(): string {
    return this.#semver;
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

  get publisherId(): string {
    return this.#publisherId;
  }

  get publishedAt(): Date {
    return this.#publishedAt;
  }

  // A published version never changes: the same content is this version, other content is
  // refused (FR-004).
  republish(
    definition: CheckedDefinition,
  ): Result<Publication, WorkflowRefusal> {
    const same = definition.fingerprint === this.#fingerprint;

    if (!same) return { ok: false, failure: WorkflowRefusal.VersionTaken };

    return { ok: true, value: { version: this, created: false } };
  }
}
