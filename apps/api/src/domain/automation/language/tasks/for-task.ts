import { Expression } from '../expression.js';
import type { ParsedForTask, ForTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskList } from '../task-list.js';
import { TaskSettings } from '../task-settings.js';

export class ForTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #each: string;
  readonly #collection: Expression | null;
  readonly #at: string;
  readonly #whilst: Expression | null;
  readonly #body: TaskList;

  constructor(props: ForTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#each = props.each;
    this.#collection = props.collection;
    this.#at = props.at;
    this.#whilst = props.whilst;
    this.#body = props.body;
  }

  static build(name: string, parsed: ParsedForTask, scope: Scope): ForTask {
    const each = parsed.for.each ?? 'item';
    const at = parsed.for.at ?? 'index';
    const iteration = [each, at];
    const loop = scope.at('for');
    const collectionAt = loop.at('in');
    const whileAt = scope.at('while').declaring(iteration);
    const bodyAt = scope.at('do').declaring(iteration);
    const settings = TaskSettings.read(parsed, scope);
    const collection = Expression.read(parsed.for.in, collectionAt);
    const whilst = Expression.read(parsed.while, whileAt);
    const body = TaskList.build(parsed.do, bodyAt);
    return new ForTask({
      name,
      reference: scope.pointer,
      settings,
      each,
      collection,
      at,
      whilst,
      body,
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

  get each(): string {
    return this.#each;
  }

  get collection(): Expression | null {
    return this.#collection;
  }

  get at(): string {
    return this.#at;
  }

  get whilst(): Expression | null {
    return this.#whilst;
  }

  get body(): TaskList {
    return this.#body;
  }
}
