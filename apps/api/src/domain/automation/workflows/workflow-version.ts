import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import type { CheckedDefinition } from "./checked-definition.js";
import { WorkflowRefusal } from "./enums.js";
import type {
  NewPublication,
  Publication,
  Schedule,
  WorkflowVersionProps,
} from "./interfaces.js";

export class WorkflowVersion {
  readonly #id: string;
  readonly #semver: string;
  readonly #dsl: string;
  readonly #digest: string;
  readonly #programFingerprint: string;
  readonly #schedule: Schedule | null;
  readonly #secrets: readonly string[];
  readonly #publisherId: string;
  readonly #publishedAt: Date;

  constructor(props: WorkflowVersionProps) {
    this.#id = props.id;
    this.#semver = props.semver;
    this.#dsl = props.dsl;
    this.#digest = props.digest;
    this.#programFingerprint = props.programFingerprint;
    this.#schedule = props.schedule;
    this.#secrets = props.secrets;
    this.#publisherId = props.publisherId;
    this.#publishedAt = props.publishedAt;
  }

  static publish(input: NewPublication): WorkflowVersion {
    const definition = input.definition;
    const id = randomUUID();
    return new WorkflowVersion({
      id,
      semver: definition.version,
      dsl: definition.dsl,
      digest: definition.digest,
      programFingerprint: definition.programFingerprint,
      schedule: definition.schedule,
      secrets: definition.secrets,
      publisherId: input.publisherId,
      publishedAt: input.now,
    });
  }

  get id(): string {
    return this.#id;
  }

  get semver(): string {
    return this.#semver;
  }

  get dsl(): string {
    return this.#dsl;
  }

  get digest(): string {
    return this.#digest;
  }

  get programFingerprint(): string {
    return this.#programFingerprint;
  }

  get schedule(): Schedule | null {
    return this.#schedule;
  }

  get secrets(): readonly string[] {
    return this.#secrets;
  }

  get publisherId(): string {
    return this.#publisherId;
  }

  get publishedAt(): Date {
    return this.#publishedAt;
  }

  republish(
    definition: CheckedDefinition,
  ): Result<Publication, WorkflowRefusal> {
    const same = definition.digest === this.#digest;

    if (!same) return { ok: false, failure: WorkflowRefusal.VersionTaken };

    return { ok: true, value: { version: this, created: false } };
  }
}
