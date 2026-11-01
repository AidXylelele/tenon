export class LifecycleEventType {
  static readonly WorkflowStarted = new LifecycleEventType(
    'workflow.started',
    'startedAt',
    true,
  );
  static readonly WorkflowFaulted = new LifecycleEventType(
    'workflow.faulted',
    'faultedAt',
    false,
  );
  static readonly WorkflowCompleted = new LifecycleEventType(
    'workflow.completed',
    'completedAt',
    false,
  );
  static readonly TaskCreated = new LifecycleEventType(
    'task.created',
    'createdAt',
    false,
  );
  static readonly TaskStarted = new LifecycleEventType(
    'task.started',
    'startedAt',
    false,
  );
  static readonly TaskRetried = new LifecycleEventType(
    'task.retried',
    'retriedAt',
    false,
  );
  static readonly TaskCancelled = new LifecycleEventType(
    'task.cancelled',
    'cancelledAt',
    false,
  );
  static readonly TaskFaulted = new LifecycleEventType(
    'task.faulted',
    'faultedAt',
    false,
  );
  static readonly TaskCompleted = new LifecycleEventType(
    'task.completed',
    'completedAt',
    false,
  );

  static readonly #NAMESPACE = 'io.serverlessworkflow';
  static readonly #VERSION = 'v1';

  readonly #name: string;
  readonly #timeProperty: string;
  readonly #describesDefinition: boolean;

  private constructor(
    name: string,
    timeProperty: string,
    describesDefinition: boolean,
  ) {
    this.#name = name;
    this.#timeProperty = timeProperty;
    this.#describesDefinition = describesDefinition;
  }

  get type(): string {
    const namespace = LifecycleEventType.#NAMESPACE;
    const version = LifecycleEventType.#VERSION;
    return `${namespace}.${this.#name}.${version}`;
  }

  get timeProperty(): string {
    return this.#timeProperty;
  }

  get describesDefinition(): boolean {
    return this.#describesDefinition;
  }
}
