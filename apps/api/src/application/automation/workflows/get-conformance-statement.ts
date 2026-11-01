import { Injectable } from '@nestjs/common';
import {
  AuthenticationScheme,
  CallKind,
  Contradiction,
  DslVersion,
  RunKind,
  ScriptLanguage,
  TaskKind,
  UnsupportedConstruct,
} from '../../../domain/automation/language/enums.js';
import type { ConformanceStatement } from './ports.js';

@Injectable()
export class GetConformanceStatement {
  execute(): ConformanceStatement {
    const dsl = Object.values(DslVersion);
    const tasks = Object.values(TaskKind);
    const calls = Object.values(CallKind);
    const runs = Object.values(RunKind);
    const scriptLanguages = Object.values(ScriptLanguage);
    const authentications = Object.values(AuthenticationScheme);
    const excluded = Object.values(UnsupportedConstruct);
    const contradictions = Object.values(Contradiction);
    return {
      dsl,
      tasks,
      calls,
      runs,
      scriptLanguages,
      authentications,
      excluded,
      contradictions,
    };
  }
}
