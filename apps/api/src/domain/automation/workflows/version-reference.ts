import type { WorkflowTarget } from '../language/workflow-target.js';
import type { VersionReferenceProps } from './interfaces.js';
import type { Workflow } from './workflow.js';

export class VersionReference {
  readonly #versionId: string | null;
  readonly #workflowId: string | null;
  readonly #semver: string | null;

  private constructor(props: VersionReferenceProps) {
    this.#versionId = props.versionId;
    this.#workflowId = props.workflowId;
    this.#semver = props.semver;
  }

  static forTarget(
    workflow: Workflow | null,
    target: WorkflowTarget,
  ): VersionReference {
    if (workflow === null) return VersionReference.#none();

    if (!target.isLatest())
      return new VersionReference({
        versionId: null,
        workflowId: workflow.id,
        semver: target.version,
      });

    const current = workflow.currentVersionId;

    if (current === null) return VersionReference.#none();

    return VersionReference.byId(current);
  }

  static byId(versionId: string): VersionReference {
    return new VersionReference({ versionId, workflowId: null, semver: null });
  }

  static #none(): VersionReference {
    return new VersionReference({
      versionId: null,
      workflowId: null,
      semver: null,
    });
  }

  get versionId(): string | null {
    return this.#versionId;
  }

  get workflowId(): string | null {
    return this.#workflowId;
  }

  get semver(): string | null {
    return this.#semver;
  }
}
