import type { Graph } from './graph.js';
import type { ReleaseProps, WorkflowSettings } from './interfaces.js';

export class Release {
  readonly #workflowId: string;
  readonly #number: number;
  readonly #graph: Graph;
  readonly #settings: WorkflowSettings;
  readonly #publishedAt: Date;
  readonly #publishedBy: string;

  constructor(props: ReleaseProps) {
    this.#workflowId = props.workflowId;
    this.#number = props.number;
    this.#graph = props.graph;
    this.#settings = props.settings;
    this.#publishedAt = props.publishedAt;
    this.#publishedBy = props.publishedBy;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get number(): number {
    return this.#number;
  }

  get graph(): Graph {
    return this.#graph;
  }

  get settings(): WorkflowSettings {
    return this.#settings;
  }

  get publishedAt(): Date {
    return this.#publishedAt;
  }

  get publishedBy(): string {
    return this.#publishedBy;
  }

  get hasTrigger(): boolean {
    return this.#graph.triggers.some((node) => !node.disabled);
  }

  get credentialIds(): string[] {
    return this.#graph.credentialIds;
  }
}
