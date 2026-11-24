import type { JsonObject } from "../interfaces.js";
import type { CheckedDefinitionProps, ImportTexts } from "./interfaces.js";
import type { Schedule } from "./schedule.js";
import type { WorkflowName } from "./workflow-name.js";

export class CheckedDefinition {
  readonly #name: WorkflowName;
  readonly #version: string;
  readonly #dsl: string;
  readonly #digest: string;
  readonly #document: JsonObject;
  readonly #imports: ImportTexts;
  readonly #programFingerprint: string;
  readonly #schedule: Schedule | null;
  readonly #secrets: readonly string[];

  constructor(props: CheckedDefinitionProps) {
    this.#name = props.name;
    this.#version = props.version;
    this.#dsl = props.dsl;
    this.#digest = props.digest;
    this.#document = props.document;
    this.#imports = props.imports;
    this.#programFingerprint = props.programFingerprint;
    this.#schedule = props.schedule;
    this.#secrets = props.secrets;
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

  get digest(): string {
    return this.#digest;
  }

  get document(): JsonObject {
    return this.#document;
  }

  get imports(): ImportTexts {
    return this.#imports;
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
}
