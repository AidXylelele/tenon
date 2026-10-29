import { randomUUID } from 'node:crypto';
import type { Definition } from '../language/definition.js';
import type { NewWorkflowVersion, WorkflowVersionProps } from './interfaces.js';
import type { SourceDocument } from './source-document.js';

export class WorkflowVersion {
  readonly #id: string;
  readonly #workflowId: string;
  readonly #semver: string;
  readonly #source: SourceDocument;
  readonly #definition: Definition;
  readonly #publisherId: string;
  readonly #publishedAt: Date;

  constructor(props: WorkflowVersionProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#semver = props.semver;
    this.#source = props.source;
    this.#definition = props.definition;
    this.#publisherId = props.publisherId;
    this.#publishedAt = props.publishedAt;
  }

  static publish(input: NewWorkflowVersion): WorkflowVersion {
    const definition = input.definition;
    const workflowName = input.workflow.workflowName;
    const belongs = definition.workflow.equals(workflowName);

    if (!belongs)
      throw new TypeError('The definition belongs to another workflow');

    const id = randomUUID();
    return new WorkflowVersion({
      id,
      workflowId: input.workflow.id,
      semver: definition.version,
      source: input.source,
      definition,
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

  get dslVersion(): string {
    return this.#definition.dslVersion;
  }

  get source(): SourceDocument {
    return this.#source;
  }

  get definition(): Definition {
    return this.#definition;
  }

  get publisherId(): string {
    return this.#publisherId;
  }

  get publishedAt(): Date {
    return this.#publishedAt;
  }

  confirmSame(source: SourceDocument): void {
    this.#source.confirmSame(source);
  }
}
