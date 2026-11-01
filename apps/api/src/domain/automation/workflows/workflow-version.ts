import type { DslVersion } from '../language/enums.js';
import type { WorkflowVersionProps } from './interfaces.js';
import type { SourceDocument } from './source-document.js';

export class WorkflowVersion {
  readonly #id: string;
  readonly #workflowId: string;
  readonly #semver: string;
  readonly #dslVersion: DslVersion;
  readonly #source: SourceDocument;
  readonly #publisherId: string;
  readonly #publishedAt: Date;

  constructor(props: WorkflowVersionProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#semver = props.semver;
    this.#dslVersion = props.dslVersion;
    this.#source = props.source;
    this.#publisherId = props.publisherId;
    this.#publishedAt = props.publishedAt;
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

  get dslVersion(): DslVersion {
    return this.#dslVersion;
  }

  get source(): SourceDocument {
    return this.#source;
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
