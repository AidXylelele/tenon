import { UnsupportedConstructError } from '../../../../domain/errors.js';
import {
  ProcessReturn,
  ScriptLanguage,
  UnsupportedConstruct,
} from '../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import { RunScriptTask } from '../../../../domain/automation/language/tasks/run-script-task.js';
import type * as Dsl from '../../interfaces.js';
import { TemplateMapper } from '../template.mapper.js';

export class RunScriptTaskMapper {
  static toDomain(node: Dsl.RunScript, props: TaskProps): RunScriptTask {
    const scriptAt = props.reference.at('run').at('script');
    const languages = Object.values(ScriptLanguage);
    const language = languages.find(
      (value: string) => value === node.script.language,
    );

    if (language === undefined) {
      const languageAt = scriptAt.at('language');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ScriptLanguage,
        languageAt,
      );
    }

    if (node.script.source !== undefined) {
      const sourceAt = scriptAt.at('source');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ScriptSource,
        sourceAt,
      );
    }

    const script = TemplateMapper.toDomain(node.script, scriptAt);
    const awaits = node.await ?? null;
    const processReturns = Object.values(ProcessReturn);
    const returned = processReturns.find(
      (value: string) => value === node.return,
    );
    const returns = returned ?? null;
    return new RunScriptTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      language,
      script,
      awaits,
      returns,
    });
  }
}
