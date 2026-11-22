import { WorkflowEvents } from "@nestjs/workflows";
import { WorkflowMetrics } from "../../../../src/frameworks/opentelemetry/workflow.metrics.js";
import { RecordedMetrics } from "../../../support/recorded-metrics.js";

const AT = Date.UTC(2026, 0, 1);

describe("the metrics of the workflow engine", () => {
  let recorded: RecordedMetrics;
  let events: WorkflowEvents;
  let workflowMetrics: WorkflowMetrics;

  beforeEach(() => {
    recorded = new RecordedMetrics();
    events = new WorkflowEvents();
    workflowMetrics = new WorkflowMetrics(events);
    workflowMetrics.onModuleInit();
  });

  afterEach(() => {
    workflowMetrics.onApplicationShutdown();
    vi.restoreAllMocks();
  });

  it("counts_each_execution_by_its_workflow_and_whether_it_started_or_resumed", () => {
    const base = {
      id: "run:1:1",
      workflow: "open-workflow",
      version: 3,
      at: AT,
    };

    events.emit({ ...base, type: "workflow-started" });
    events.emit({ ...base, type: "workflow-resumed", run: 2 });

    expect(recorded.pointsOf("tenon.workflow.executions")).toEqual([
      {
        value: 1,
        attributes: {
          "tenon.workflow": "open-workflow",
          "tenon.execution.kind": "started",
        },
      },
      {
        value: 1,
        attributes: {
          "tenon.workflow": "open-workflow",
          "tenon.execution.kind": "resumed",
        },
      },
    ]);
  });

  it("records_a_completed_attempt_in_seconds_by_the_kind_of_its_step", () => {
    events.emit({
      id: "run:1:1",
      workflow: "open-workflow",
      version: 3,
      at: AT,
      type: "step-completed",
      step: "respond:/do/0/fetch",
      attempt: 1,
      durationMs: 250,
    });

    expect(recorded.pointsOf("tenon.workflow.step.duration")).toEqual([
      {
        value: 0.25,
        attributes: {
          "tenon.workflow": "open-workflow",
          "tenon.step.kind": "respond",
        },
      },
    ]);
    const options = recorded.optionsOf("tenon.workflow.step.duration");
    const longest = options?.advice?.explicitBucketBoundaries?.at(-1);
    expect(options?.unit).toBe("s");
    expect(longest).toBe(10);
  });

  it("counts_a_compensation_that_gave_up_by_its_workflow", () => {
    const error = { name: "Error", message: "The refund failed" };

    events.emit({
      id: "run:1:1",
      workflow: "open-workflow",
      version: 3,
      at: AT,
      type: "workflow-compensation-failed",
      error,
    });

    expect(recorded.pointsOf("tenon.workflow.compensation.failures")).toEqual([
      { value: 1, attributes: { "tenon.workflow": "open-workflow" } },
    ]);
  });

  it("records_nothing_once_the_application_shut_down", () => {
    workflowMetrics.onApplicationShutdown();

    events.emit({
      id: "run:1:1",
      workflow: "open-workflow",
      version: 3,
      at: AT,
      type: "workflow-started",
    });

    expect(recorded.pointsOf("tenon.workflow.executions")).toEqual([]);
  });
});
