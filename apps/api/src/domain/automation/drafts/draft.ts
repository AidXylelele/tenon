import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Result } from "../../interfaces.js";
import type { JsonObject } from "../interfaces.js";
import type { WorkflowName } from "../workflows/workflow-name.js";
import { DraftRefusal } from "./enums.js";
import type {
  DraftAuthor,
  DraftEdit,
  DraftProps,
  DraftSnapshot,
  NewDraft,
} from "./interfaces.js";

export class Draft {
  readonly #name: WorkflowName;
  readonly #basis: string | null;
  #source: string;
  #layout: JsonObject;
  #revision: string;
  #savedBy: DraftAuthor;
  #savedAt: Date;

  constructor(props: DraftProps) {
    this.#name = props.name;
    this.#source = props.source;
    this.#layout = props.layout;
    this.#revision = props.revision;
    this.#basis = props.basis;
    this.#savedBy = props.savedBy;
    this.#savedAt = props.savedAt;
  }

  static create(input: NewDraft): Draft {
    const revision = randomUUID();
    return new Draft({
      name: input.name,
      source: input.source,
      layout: input.layout,
      revision,
      basis: null,
      savedBy: input.author,
      savedAt: input.now,
    });
  }

  get name(): WorkflowName {
    return this.#name;
  }

  get source(): string {
    return this.#source;
  }

  get layout(): JsonObject {
    return this.#layout;
  }

  get revision(): string {
    return this.#revision;
  }

  get basis(): string | null {
    return this.#basis;
  }

  get savedBy(): DraftAuthor {
    return this.#savedBy;
  }

  get savedAt(): Date {
    return this.#savedAt;
  }

  get snapshot(): DraftSnapshot {
    return {
      source: this.#source,
      layout: this.#layout,
      revision: this.#revision,
      savedBy: this.#savedBy,
      savedAt: this.#savedAt,
    };
  }

  isAt(revision: string): boolean {
    return this.#revision === revision;
  }

  save(edit: DraftEdit): Result<boolean, DraftRefusal> {
    if (this.isAt(edit.expected)) {
      this.#apply(edit);
      return { ok: true, value: true };
    }

    if (this.#holds(edit)) return { ok: true, value: false };

    return { ok: false, failure: DraftRefusal.Stale };
  }

  #apply(edit: DraftEdit): void {
    this.#source = edit.source;
    this.#layout = edit.layout;
    this.#revision = randomUUID();
    this.#savedBy = edit.author;
    this.#savedAt = edit.now;
  }

  #holds(edit: DraftEdit): boolean {
    const sameAuthor = edit.author.id === this.#savedBy.id;
    const sameSource = edit.source === this.#source;
    const sameLayout = isDeepStrictEqual(edit.layout, this.#layout);
    return sameAuthor && sameSource && sameLayout;
  }
}
