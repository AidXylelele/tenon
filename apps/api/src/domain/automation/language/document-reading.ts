import { Definition } from './definition.js';
import { DefinitionBuild } from './definition-build.js';
import type { ParsedDocument } from './interfaces.js';
import type { Problem } from './problem.js';

export class DocumentReading {
  readonly #parsed: ParsedDocument | null;
  readonly #problems: readonly Problem[];

  constructor(parsed: ParsedDocument | null, problems: readonly Problem[]) {
    this.#parsed = parsed;
    this.#problems = problems;
  }

  build(): DefinitionBuild {
    if (this.#parsed === null)
      return DefinitionBuild.unreadable(this.#problems);

    return Definition.build(this.#parsed);
  }
}
