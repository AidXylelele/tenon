import type {
  Evaluation,
  ProcessRun,
  RoundWorkProps,
  ServiceCall,
  Validation,
} from './interfaces.js';

export class RoundWork {
  readonly #evaluations: readonly Evaluation[];
  readonly #validations: readonly Validation[];
  readonly #calls: readonly ServiceCall[];
  readonly #processes: readonly ProcessRun[];

  constructor(props: RoundWorkProps) {
    this.#evaluations = props.evaluations;
    this.#validations = props.validations;
    this.#calls = props.calls;
    this.#processes = props.processes;
  }

  static none(): RoundWork {
    return new RoundWork({
      evaluations: [],
      validations: [],
      calls: [],
      processes: [],
    });
  }

  static combined(works: readonly RoundWork[]): RoundWork {
    const evaluations = works.flatMap((work) => work.#evaluations);
    const validations = works.flatMap((work) => work.#validations);
    const calls = works.flatMap((work) => work.#calls);
    const processes = works.flatMap((work) => work.#processes);
    return new RoundWork({ evaluations, validations, calls, processes });
  }

  static evaluating(evaluations: readonly Evaluation[]): RoundWork {
    return new RoundWork({
      evaluations,
      validations: [],
      calls: [],
      processes: [],
    });
  }

  static calling(call: ServiceCall): RoundWork {
    return new RoundWork({
      evaluations: [],
      validations: [],
      calls: [call],
      processes: [],
    });
  }

  static running(run: ProcessRun): RoundWork {
    return new RoundWork({
      evaluations: [],
      validations: [],
      calls: [],
      processes: [run],
    });
  }

  get evaluations(): readonly Evaluation[] {
    return this.#evaluations;
  }

  get validations(): readonly Validation[] {
    return this.#validations;
  }

  get calls(): readonly ServiceCall[] {
    return this.#calls;
  }

  get processes(): readonly ProcessRun[] {
    return this.#processes;
  }

  isEmpty(): boolean {
    const evaluations = this.#evaluations.length;
    const validations = this.#validations.length;
    const calls = this.#calls.length;
    const processes = this.#processes.length;
    return evaluations + validations + calls + processes === 0;
  }
}
