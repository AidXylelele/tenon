import { DataSpec } from './data-spec.js';
import { DefinitionBuild } from './definition-build.js';
import { type Duration, DurationFactory } from './duration-factory.js';
import { Findings } from './findings.js';
import type { DefinitionProps, ParsedDocument } from './interfaces.js';
import { ReusableComponents } from './reusable-components.js';
import { Scope } from './scope.js';
import { SupportedSubset } from './supported-subset.js';
import { TaskList } from './task-list.js';
import { WorkflowName } from './workflow-name.js';

export class Definition {
  readonly #document: ParsedDocument;
  readonly #input: DataSpec;
  readonly #output: DataSpec;
  readonly #timeout: Duration | null;
  readonly #components: ReusableComponents;
  readonly #body: TaskList;

  constructor(props: DefinitionProps) {
    this.#document = props.document;
    this.#input = props.input;
    this.#output = props.output;
    this.#timeout = props.timeout;
    this.#components = props.components;
    this.#body = props.body;
  }

  static build(parsed: ParsedDocument): DefinitionBuild {
    const findings = new Findings();
    const root = Scope.root(findings);
    const useAt = root.at('use');
    SupportedSubset.acceptsDocument(parsed, root);
    const components = ReusableComponents.read(parsed.use, useAt);
    const scope = root.using(components);
    const inputAt = scope.at('input');
    const outputAt = scope.at('output');
    const timeoutAt = scope.at('timeout');
    const bodyAt = scope.at('do');
    const input = DataSpec.input(parsed.input, inputAt);
    const output = DataSpec.output(parsed.output, outputAt);
    const timeout = DurationFactory.timeout(parsed.timeout, timeoutAt);
    const body = TaskList.build(parsed.do, bodyAt);
    const clean = findings.isClean();
    const definition = clean
      ? new Definition({
          document: parsed,
          input,
          output,
          timeout,
          components,
          body,
        })
      : null;
    return new DefinitionBuild({
      definition,
      problems: findings.problems,
      expressions: findings.expressions,
      references: findings.references,
    });
  }

  static restore(parsed: ParsedDocument): Definition {
    const build = Definition.build(parsed);
    const definition = build.definition;

    if (definition === null)
      throw new TypeError('A stored definition no longer builds');

    return definition;
  }

  get document(): ParsedDocument {
    return this.#document;
  }

  get dslVersion(): string {
    return this.#document.document.dsl;
  }

  get workflow(): WorkflowName {
    const header = this.#document.document;
    return new WorkflowName(header.namespace, header.name);
  }

  get version(): string {
    return this.#document.document.version;
  }

  get input(): DataSpec {
    return this.#input;
  }

  get output(): DataSpec {
    return this.#output;
  }

  get timeout(): Duration | null {
    return this.#timeout;
  }

  get components(): ReusableComponents {
    return this.#components;
  }

  get body(): TaskList {
    return this.#body;
  }
}
