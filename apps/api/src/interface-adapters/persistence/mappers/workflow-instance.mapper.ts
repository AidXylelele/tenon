import { Injectable } from "@nestjs/common";
import { Run } from "../../../domain/automation/instances/run.js";
import { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import {
  Cipher,
  type SealedRun,
  type WorkflowInstanceRow,
} from "../interfaces.js";

@Injectable()
export class WorkflowInstanceMapper {
  constructor(private readonly cipher: Cipher) {}

  toRow(instance: WorkflowInstance): WorkflowInstanceRow {
    const run = instance.run;
    return {
      id: instance.id,
      workflowId: instance.workflowId,
      versionId: instance.versionId,
      trigger: instance.trigger,
      starterId: instance.starterId,
      originId: instance.originId,
      originEffectId: instance.originEffectId,
      input: instance.input,
      phase: instance.phase,
      output: instance.output,
      error: instance.error,
      createdAt: instance.createdAt,
      startedAt: instance.startedAt,
      endedAt: instance.endedAt,
      runState: this.#sealed(run),
      runFormat: run?.format ?? null,
      programFingerprint: run?.fingerprint ?? null,
      runWaits: instance.waits,
      cancelReason: instance.cancelReason,
      test: instance.test,
      version: instance.version,
    };
  }

  toEntity(row: WorkflowInstanceRow): WorkflowInstance {
    const input = row.input ?? null;
    const run = this.#runOf(row);
    return new WorkflowInstance({
      id: row.id,
      workflowId: row.workflowId,
      versionId: row.versionId,
      trigger: row.trigger,
      starterId: row.starterId,
      originId: row.originId,
      originEffectId: row.originEffectId,
      input,
      phase: row.phase,
      output: row.output,
      error: row.error,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      cancelReason: row.cancelReason,
      run,
      test: row.test,
      version: row.version,
    });
  }

  #sealed(run: Run | null): string | null {
    if (run === null) return null;

    const state: SealedRun = {
      memento: run.memento,
      awaited: run.awaited,
      listening: run.listening,
      receiving: run.receiving,
      taken: run.taken,
      secretTexts: run.secretTexts,
      output: run.output,
      error: run.error,
    };
    const text = JSON.stringify(state);
    return this.cipher.seal(text);
  }

  #runOf(row: WorkflowInstanceRow): Run | null {
    const sealed = row.runState;

    if (sealed === null) return null;

    const text = this.cipher.open(sealed);
    const state = JSON.parse(text) as SealedRun;
    const fingerprint = row.programFingerprint ?? "";
    const format = row.runFormat ?? 0;
    return new Run({
      fingerprint,
      format,
      memento: state.memento,
      awaited: state.awaited,
      listening: state.listening,
      receiving: state.receiving,
      taken: state.taken,
      secretTexts: state.secretTexts,
      output: state.output,
      error: state.error,
    });
  }
}
