import { Problem } from './problem.js';
import type { ReferenceFacts } from './reference-facts.js';
import type { WorkflowReference } from './workflow-reference.js';

export class DocumentReferences {
  readonly #references: readonly WorkflowReference[];

  constructor(references: readonly WorkflowReference[]) {
    this.#references = references;
  }

  check(facts: ReferenceFacts): readonly Problem[] {
    const problems: Problem[] = [];

    for (const reference of this.#references) {
      const problem = this.#problemOf(reference, facts);

      if (problem !== null) problems.push(problem);
    }

    return problems;
  }

  #problemOf(
    reference: WorkflowReference,
    facts: ReferenceFacts,
  ): Problem | null {
    const target = reference.target;
    const exists = facts.hasWorkflow(target.workflow);

    if (!exists)
      return new Problem(
        reference.pointer,
        `No workflow ${target.workflow.toString()} exists`,
      );

    const latest = target.isLatest();
    const published = facts.hasVersion(target);

    if (latest || published) return null;

    return new Problem(
      reference.pointer,
      `Version ${target.version} of ${target.workflow.toString()} is not published`,
    );
  }
}
