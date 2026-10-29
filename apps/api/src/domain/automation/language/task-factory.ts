import type { ParsedTask } from './interfaces.js';
import type { Scope } from './scope.js';
import { SupportedSubset } from './supported-subset.js';
import type { Task } from './task.js';
import { CallTask } from './tasks/call-task.js';
import { DoTask } from './tasks/do-task.js';
import { EmitTask } from './tasks/emit-task.js';
import { ForTask } from './tasks/for-task.js';
import { ForkTask } from './tasks/fork-task.js';
import { RaiseTask } from './tasks/raise-task.js';
import { RunScriptTask } from './tasks/run-script-task.js';
import { RunShellTask } from './tasks/run-shell-task.js';
import { RunWorkflowTask } from './tasks/run-workflow-task.js';
import { SetTask } from './tasks/set-task.js';
import { SwitchTask } from './tasks/switch-task.js';
import { TryTask } from './tasks/try-task.js';

export class TaskFactory {
  static build(name: string, parsed: ParsedTask, scope: Scope): Task | null {
    if ('call' in parsed) return CallTask.build(name, parsed, scope);

    if ('emit' in parsed) return EmitTask.build(name, parsed, scope);

    if ('for' in parsed) return ForTask.build(name, parsed, scope);

    if ('fork' in parsed) return ForkTask.build(name, parsed, scope);

    if ('raise' in parsed) return RaiseTask.build(name, parsed, scope);

    if ('set' in parsed) return SetTask.build(name, parsed, scope);

    if ('switch' in parsed) return SwitchTask.build(name, parsed, scope);

    if ('try' in parsed) return TryTask.build(name, parsed, scope);

    if ('run' in parsed) {
      const workflow = parsed.run.workflow;
      const script = parsed.run.script;
      const shell = parsed.run.shell;

      if (workflow !== undefined)
        return RunWorkflowTask.build(name, parsed, workflow, scope);

      if (script !== undefined)
        return RunScriptTask.build(name, parsed, script, scope);

      if (shell !== undefined)
        return RunShellTask.build(name, parsed, shell, scope);

      const containerAt = scope.at('run').at('container');
      SupportedSubset.refuse('container', containerAt);
      return null;
    }

    if ('wait' in parsed) {
      const waitAt = scope.at('wait');
      SupportedSubset.refuse('wait', waitAt);
      return null;
    }

    if ('listen' in parsed) {
      const listenAt = scope.at('listen');
      SupportedSubset.refuse('listen', listenAt);
      return null;
    }

    return DoTask.build(name, parsed, scope);
  }
}
