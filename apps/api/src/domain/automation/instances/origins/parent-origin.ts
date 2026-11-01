export class ParentOrigin {
  readonly #instanceId: string;
  readonly #taskId: string;

  constructor(instanceId: string, taskId: string) {
    this.#instanceId = instanceId;
    this.#taskId = taskId;
  }

  get instanceId(): string {
    return this.#instanceId;
  }

  get taskId(): string {
    return this.#taskId;
  }
}
