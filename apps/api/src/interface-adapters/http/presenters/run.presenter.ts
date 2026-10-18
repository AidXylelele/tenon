import type {
  Page,
  RunSummary,
  RunView,
  StepOutputPage,
  StepView,
} from '../../../application/interfaces.js';
import type { Run } from '../../../domain/run.js';
import type {
  QueuedRunResponse,
  RunPageResponse,
  RunResponse,
  RunSummaryResponse,
  StepOutputPageResponse,
  StepResponse,
} from '../dto/automation-responses.dto.js';

export class RunPresenter {
  static queued(run: Run): QueuedRunResponse {
    return { runId: run.id };
  }

  static summary(run: RunSummary): RunSummaryResponse {
    return {
      id: run.id,
      status: run.status,
      mode: run.mode,
      trigger: run.trigger,
      release: run.releaseNumber,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
    };
  }

  static page(page: Page<RunSummary>): RunPageResponse {
    return {
      items: page.items.map((run) => RunPresenter.summary(run)),
      nextCursor: page.nextCursor,
    };
  }

  static run(run: RunView): RunResponse {
    return {
      ...RunPresenter.summary(run),
      workflowId: run.workflowId,
      steps: run.steps.map((step) => RunPresenter.step(step)),
    };
  }

  static output(page: StepOutputPage): StepOutputPageResponse {
    return { items: [...page.items], total: page.total, offset: page.offset };
  }

  private static step(step: StepView): StepResponse {
    return {
      nodeId: step.nodeId,
      status: step.status,
      attempts: step.attempts,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      outputs: step.outputs.map((output) => ({
        port: output.port,
        items: output.items,
        bytes: output.bytes,
      })),
      error: step.error
        ? {
            kind: step.error.kind,
            message: step.error.message,
            parameter: step.error.parameter,
            itemIndex: step.error.item,
          }
        : null,
    };
  }
}
