import type {
  ParsedRunTask,
  ParsedRunWorkflow,
  RunWorkflowTaskProps,
} from '../interfaces.js';
import type { Scope } from '../scope.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';
import { WorkflowName } from '../workflow-name.js';
import { WorkflowTarget } from '../workflow-target.js';

export class RunWorkflowTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #target: WorkflowTarget;
  readonly #input: Template | null;
  readonly #awaits: boolean;

  constructor(props: RunWorkflowTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#target = props.target;
    this.#input = props.input;
    this.#awaits = props.awaits;
  }

  static build(
    name: string,
    parsed: ParsedRunTask,
    workflow: ParsedRunWorkflow,
    scope: Scope,
  ): RunWorkflowTask {
    const workflowAt = scope.at('run').at('workflow');
    const inputAt = workflowAt.at('input');
    const settings = TaskSettings.read(parsed, scope);
    const version = workflow.version ?? WorkflowTarget.LATEST;
    const named = new WorkflowName(workflow.namespace, workflow.name);
    const target = new WorkflowTarget(named, version);
    workflowAt.reference(target);
    const input = Template.read(workflow.input, inputAt);
    const awaits = parsed.run.await ?? true;
    return new RunWorkflowTask({
      name,
      reference: scope.pointer,
      settings,
      target,
      input,
      awaits,
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

  get target(): WorkflowTarget {
    return this.#target;
  }

  get input(): Template | null {
    return this.#input;
  }

  get awaits(): boolean {
    return this.#awaits;
  }
}
