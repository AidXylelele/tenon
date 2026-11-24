import { Injectable } from "@nestjs/common";
import type { Diagnostic, Schedule as ProtocolSchedule } from "interpreter";
import type { DefinitionProblem } from "../../../application/automation/workflows/interfaces.js";
import { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import type {
  ImportTexts,
  ScheduleSpec,
} from "../../../domain/automation/workflows/interfaces.js";
import { Schedule } from "../../../domain/automation/workflows/schedule.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { CompiledData } from "../interfaces.js";

@Injectable()
export class DefinitionMapper {
  private static readonly CRON = "cron";
  private static readonly CRON_POINTER = "/schedule/cron";

  toDefinition(
    compiled: CompiledData,
    imports: ImportTexts,
  ): Result<CheckedDefinition, readonly DefinitionProblem[]> {
    const document = compiled.document;
    const manifest = compiled.manifest;
    const identity = manifest.identity;
    const name = new WorkflowName(identity.namespace, identity.name);
    const [declared] = manifest.schedules;
    const scheduled = this.#scheduleOf(declared);

    if (!scheduled.ok) return scheduled;

    const definition = new CheckedDefinition({
      name,
      version: identity.version,
      dsl: identity.dsl,
      digest: compiled.digest,
      document,
      imports,
      programFingerprint: compiled.fingerprint,
      schedule: scheduled.value,
      secrets: manifest.secrets,
    });
    return { ok: true, value: definition };
  }

  toProblems(
    diagnostics: readonly Diagnostic[],
    failures: ReadonlyMap<string, string>,
  ): readonly DefinitionProblem[] {
    return diagnostics.map((diagnostic) => {
      const start = diagnostic.range?.start ?? null;
      return {
        code: diagnostic.code,
        pointer: diagnostic.pointer,
        detail: this.#detailOf(diagnostic, failures),
        line: start?.line ?? null,
        column: start?.column ?? null,
      };
    });
  }

  #scheduleOf(
    declared: ProtocolSchedule | undefined,
  ): Result<Schedule | null, readonly DefinitionProblem[]> {
    if (declared === undefined) return { ok: true, value: null };

    const spec = this.#specOf(declared);
    const schedule = Schedule.of(spec);

    if (schedule.ok) return schedule;

    const problem = {
      code: DefinitionMapper.CRON,
      pointer: DefinitionMapper.CRON_POINTER,
      detail: schedule.failure,
      line: null,
      column: null,
    };
    return { ok: false, failure: [problem] };
  }

  #specOf(schedule: ProtocolSchedule): ScheduleSpec {
    switch (schedule.kind) {
      case "every":
        return { kind: ScheduleKind.Every, interval: schedule.interval };
      case "cron":
        return { kind: ScheduleKind.Cron, cron: schedule.cron };
      case "after":
        return { kind: ScheduleKind.After, delay: schedule.delay };
      case "on":
        return {
          kind: ScheduleKind.On,
          stream: schedule.stream,
          types: schedule.types,
        };
    }
  }

  #detailOf(
    diagnostic: Diagnostic,
    failures: ReadonlyMap<string, string>,
  ): string {
    const reference = diagnostic.import?.reference ?? null;
    const reason = reference === null ? undefined : failures.get(reference);

    if (reason === undefined) return diagnostic.message;

    return `Import '${String(reference)}' could not be fetched: ${reason}`;
  }
}
