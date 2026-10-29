import { CatchClause } from '../catch-clause.js';
import type { ParsedTryTask, TryTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskList } from '../task-list.js';
import { TaskSettings } from '../task-settings.js';

export class TryTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #body: TaskList;
  readonly #catchClause: CatchClause;

  constructor(props: TryTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#body = props.body;
    this.#catchClause = props.catchClause;
  }

  static build(name: string, parsed: ParsedTryTask, scope: Scope): TryTask {
    const bodyAt = scope.at('try');
    const catchAt = scope.at('catch');
    const settings = TaskSettings.read(parsed, scope);
    const body = TaskList.build(parsed.try, bodyAt);
    const catchClause = CatchClause.read(parsed.catch, catchAt);
    return new TryTask({
      name,
      reference: scope.pointer,
      settings,
      body,
      catchClause,
    });
  }

  get name(): string {
    return this.#name;
  }

  get reference(): string {
    return this.#reference;
  }

  get settings(): TaskSettings {
    return this.#settings;
  }

  get body(): TaskList {
    return this.#body;
  }

  get catchClause(): CatchClause {
    return this.#catchClause;
  }
}
