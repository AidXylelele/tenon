import { RunMode } from '../../../domain/enums.js';
import type { Graph } from '../../../domain/graph.js';
import { Run } from '../../../domain/run.js';
import type { Step } from '../../../domain/step.js';
import type { RunRow, StepRow } from '../../interfaces.js';
import { GraphMapper } from './graph.mapper.js';

export class RunMapper {
  static toRow(run: Run): RunRow {
    return {
      id: run.id,
      workflowId: run.workflowId,
      workflowName: run.workflowName,
      releaseNumber: run.releaseNumber,
      mode: run.mode,
      triggerType: run.trigger.type,
      triggerNodeId: run.trigger.nodeId,
      triggerKey: run.trigger.key,
      actingUserId: run.actingUserId,
      status: run.status,
      error: run.error,
      graphSnapshot:
        run.mode === RunMode.Test ? GraphMapper.toProps(run.graph) : null,
      input: [...run.input],
      pins: [...run.pins],
      timeoutMs: run.timeoutMs,
      timezone: run.timezone,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      updatedAt: new Date(),
      version: run.version,
    };
  }

  static toStepRow(runId: string, step: Step): StepRow {
    return {
      runId,
      nodeId: step.nodeId,
      status: step.status,
      attempts: step.attempts,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      outputs: [...step.outputs],
      error: step.error,
    };
  }

  static toEntity(row: RunRow, steps: readonly StepRow[], graph: Graph): Run {
    const stepProps = steps.map((step) => ({
      nodeId: step.nodeId,
      status: step.status,
      attempts: step.attempts,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      outputs: step.outputs,
      error: step.error,
    }));
    return new Run({
      id: row.id,
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      releaseNumber: row.releaseNumber,
      mode: row.mode,
      trigger: {
        type: row.triggerType,
        nodeId: row.triggerNodeId,
        key: row.triggerKey,
      },
      graph,
      actingUserId: row.actingUserId,
      timeoutMs: row.timeoutMs,
      timezone: row.timezone,
      input: row.input,
      pins: row.pins,
      status: row.status,
      error: row.error,
      steps: stepProps,
      queuedAt: row.queuedAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      version: row.version,
    });
  }
}
