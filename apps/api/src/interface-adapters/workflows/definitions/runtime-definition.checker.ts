import { Injectable } from '@nestjs/common';
import type {
  ConformanceView,
  DefinitionChecker,
  DefinitionProblem,
} from '../../../application/automation/workflows/ports.js';
import type { JsonObject } from '../../../domain/automation/json.js';
import { CheckedDefinition } from '../../../domain/automation/workflows/checked-definition.js';
import { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { Result } from '../../../domain/result.js';
import { VerdictKind } from '../enums.js';
import { RuntimeChecks } from '../interfaces.js';

@Injectable()
export class RuntimeDefinitionChecker implements DefinitionChecker {
  constructor(private readonly runtime: RuntimeChecks) {}

  async check(
    document: JsonObject,
    secrets: readonly string[],
  ): Promise<Result<CheckedDefinition, DefinitionProblem>> {
    const verdict = await this.runtime.check(document, secrets);

    if (verdict.kind === VerdictKind.Invalid)
      return { ok: false, failure: verdict.problem };

    const identity = verdict.identity;
    const name = new WorkflowName(identity.namespace, identity.name);
    const definition = new CheckedDefinition({
      name,
      version: identity.version,
      dsl: identity.dsl,
      fingerprint: identity.fingerprint,
      eventTypes: identity.eventTypes,
      document,
    });
    return { ok: true, value: definition };
  }

  statement(): ConformanceView {
    return this.runtime.statement();
  }
}
