import {
  AuthenticationScheme,
  CallKind,
  Contradiction,
  DslVersion,
  RunKind,
  ScriptLanguage,
  TaskKind,
  UnsupportedConstruct,
} from './enums.js';
import type { ConformanceStatementProps } from './interfaces.js';

export class ConformanceStatement {
  readonly #dsl: readonly string[];
  readonly #tasks: readonly string[];
  readonly #calls: readonly string[];
  readonly #runs: readonly string[];
  readonly #scriptLanguages: readonly string[];
  readonly #authentications: readonly string[];
  readonly #excluded: readonly string[];
  readonly #contradictions: readonly string[];

  constructor(props: ConformanceStatementProps) {
    this.#dsl = props.dsl;
    this.#tasks = props.tasks;
    this.#calls = props.calls;
    this.#runs = props.runs;
    this.#scriptLanguages = props.scriptLanguages;
    this.#authentications = props.authentications;
    this.#excluded = props.excluded;
    this.#contradictions = props.contradictions;
  }

  static current(): ConformanceStatement {
    const dsl = Object.values(DslVersion);
    const tasks = Object.values(TaskKind);
    const calls = Object.values(CallKind);
    const runs = Object.values(RunKind);
    const scriptLanguages = Object.values(ScriptLanguage);
    const authentications = Object.values(AuthenticationScheme);
    const excluded = Object.values(UnsupportedConstruct);
    const contradictions = Object.values(Contradiction);
    return new ConformanceStatement({
      dsl,
      tasks,
      calls,
      runs,
      scriptLanguages,
      authentications,
      excluded,
      contradictions,
    });
  }

  get dsl(): readonly string[] {
    return this.#dsl;
  }

  get tasks(): readonly string[] {
    return this.#tasks;
  }

  get calls(): readonly string[] {
    return this.#calls;
  }

  get runs(): readonly string[] {
    return this.#runs;
  }

  get scriptLanguages(): readonly string[] {
    return this.#scriptLanguages;
  }

  get authentications(): readonly string[] {
    return this.#authentications;
  }

  get excluded(): readonly string[] {
    return this.#excluded;
  }

  get contradictions(): readonly string[] {
    return this.#contradictions;
  }
}
