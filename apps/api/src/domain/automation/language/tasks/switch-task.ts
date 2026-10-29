import type { ParsedSwitchTask, SwitchTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { SwitchCase } from './switch-case.js';

export class SwitchTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #cases: readonly SwitchCase[];

  constructor(props: SwitchTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#cases = props.cases;
  }

  static build(
    name: string,
    parsed: ParsedSwitchTask,
    scope: Scope,
  ): SwitchTask {
    const casesAt = scope.at('switch');
    const settings = TaskSettings.read(parsed, scope);
    const cases: SwitchCase[] = [];

    parsed.switch.forEach((item, index) => {
      for (const [caseName, parsedCase] of Object.entries(item)) {
        const caseAt = casesAt.at(index).at(caseName);
        const switchCase = SwitchCase.read(caseName, parsedCase, caseAt);
        cases.push(switchCase);
      }
    });

    return new SwitchTask({ name, reference: scope.pointer, settings, cases });
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

  get cases(): readonly SwitchCase[] {
    return this.#cases;
  }
}
