import type { Definition } from './definition.js';
import { DocumentReferences } from './document-references.js';
import type { Expression } from './expression.js';
import type { DefinitionBuildProps, PublishedTargets } from './interfaces.js';
import type { Problem } from './problem.js';
import { ReferenceFacts } from './reference-facts.js';
import { Report } from './report.js';
import type { WorkflowReference } from './workflow-reference.js';
import type { WorkflowTarget } from './workflow-target.js';

export class DefinitionBuild {
  readonly #definition: Definition | null;
  readonly #problems: readonly Problem[];
  readonly #expressions: readonly Expression[];
  readonly #references: readonly WorkflowReference[];

  constructor(props: DefinitionBuildProps) {
    this.#definition = props.definition;
    this.#problems = props.problems;
    this.#expressions = props.expressions;
    this.#references = props.references;
  }

  static unreadable(problems: readonly Problem[]): DefinitionBuild {
    return new DefinitionBuild({
      definition: null,
      problems,
      expressions: [],
      references: [],
    });
  }

  get definition(): Definition | null {
    return this.#definition;
  }

  get problems(): readonly Problem[] {
    return this.#problems;
  }

  get expressions(): readonly Expression[] {
    return this.#expressions;
  }

  get targets(): readonly WorkflowTarget[] {
    return this.#references.map((reference) => reference.target);
  }

  report(
    expressionProblems: readonly Problem[],
    published: PublishedTargets,
  ): Report {
    const facts = ReferenceFacts.of(published);
    const references = new DocumentReferences(this.#references);
    const referenceProblems = references.check(facts);
    const problems = this.#problems.concat(
      expressionProblems,
      referenceProblems,
    );
    const clean = problems.length === 0;
    const definition = clean ? this.#definition : null;
    return new Report({ definition, problems });
  }
}
