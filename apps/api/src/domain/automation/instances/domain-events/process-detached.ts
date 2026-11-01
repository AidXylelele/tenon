import type { ProcessRun } from '../../language/interfaces.js';
import type { ProcessDetachedProps } from '../interfaces.js';

export class ProcessDetached {
  readonly #instanceId: string;
  readonly #taskInstanceId: string;
  readonly #run: ProcessRun;

  constructor(props: ProcessDetachedProps) {
    this.#instanceId = props.instanceId;
    this.#taskInstanceId = props.taskInstanceId;
    this.#run = props.run;
  }

  get instanceId(): string {
    return this.#instanceId;
  }

  get taskInstanceId(): string {
    return this.#taskInstanceId;
  }

  get run(): ProcessRun {
    return this.#run;
  }
}
