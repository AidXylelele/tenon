import type { INestApplicationContext } from "@nestjs/common";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Test } from "@nestjs/testing";
import {
  WorkflowClient,
  WorkflowsModule,
  WorkflowWorker,
} from "@nestjs/workflows";
import type { Effect, EffectOutcome } from "interpreter";
import { PermanentFault } from "../../../../../src/interface-adapters/workflows/permanent-fault.error.js";
import { EngineRunGateway } from "../../../../../src/interface-adapters/workflows/gateways/engine-run.gateway.js";
import {
  EffectClient,
  type RunAgendaView,
  type TimedWait,
} from "../../../../../src/interface-adapters/workflows/interfaces.js";
import { RunController } from "../../../../../src/interface-adapters/workflows/run.controller.js";
import { OpenWorkflowRun } from "../../../../../src/interface-adapters/workflows/runners/open-workflow.run.js";
import { RecordedSpans } from "../../../../support/recorded-spans.js";

const ENDED: RunAgendaView = {
  ended: true,
  calls: [],
  processes: [],
  detached: [],
  children: [],
  receives: [],
  waits: [],
};
const T0 = Date.UTC(2026, 0, 1);

const aCall = (id: string): Effect => ({
  id,
  deadline: null,
  kind: "http",
  method: "GET",
  endpoint: { uri: "https://crm.example.com/leads", authentication: null },
  headers: {},
  body: null,
  output: "content",
  revealAuthorization: false,
});

const answeredAt = (
  id: string,
  at: number,
  kind: "elapsed" | "expired" | "closed",
): TimedWait => ({ id, answers: [{ at, outcome: { kind } }] });

class ScriptedRuns {
  readonly answers: string[] = [];
  readonly failed: string[] = [];
  reads = 0;
  receipts = 0;

  constructor(
    private readonly first: RunAgendaView,
    private readonly next: RunAgendaView = ENDED,
    private readonly afterReceipt: RunAgendaView = first,
  ) {}

  received(): Promise<RunAgendaView> {
    this.receipts += 1;
    return Promise.resolve(this.afterReceipt);
  }

  begin(): Promise<RunAgendaView> {
    return Promise.resolve(this.first);
  }

  respond(
    _instanceId: string,
    effectId: string,
    outcome: EffectOutcome,
  ): Promise<RunAgendaView> {
    this.answers.push(`${effectId}:${outcome.kind}`);
    return Promise.resolve(this.next);
  }

  childrenEnded(): Promise<RunAgendaView> {
    this.reads += 1;
    return Promise.resolve(this.next);
  }

  fail(instanceId: string): Promise<void> {
    this.failed.push(instanceId);
    return Promise.resolve();
  }

  secretsOf(): Promise<object> {
    return Promise.resolve({});
  }
}

class ExhaustedRuns extends ScriptedRuns {
  responses = 0;

  override respond(): Promise<RunAgendaView> {
    this.responses += 1;
    const fault = new PermanentFault(
      "The interpreter ran out of time or memory",
    );
    return Promise.reject(fault);
  }
}

class TimedPerformer {
  constructor(private readonly delays: Readonly<Record<string, number>>) {}

  perform(effect: Effect): Promise<EffectOutcome> {
    const delay = this.delays[effect.id] ?? 0;
    return new Promise((resolve) => {
      setTimeout(() => {
        vi.setSystemTime(T0 + delay);
        void responded().then(resolve);
      }, delay);
    });
  }
}

class RecordingEngine {
  readonly continued: string[] = [];

  continueIn(instanceId: string, generation: number): Promise<void> {
    this.continued.push(`${instanceId}:${String(generation)}`);
    return Promise.resolve();
  }
}

class ScriptedPerformer {
  constructor(private readonly outcome: () => Promise<EffectOutcome>) {}

  perform(): Promise<EffectOutcome> {
    return this.outcome();
  }
}

const responded = (): Promise<EffectOutcome> =>
  Promise.resolve({
    kind: "responded",
    request: { method: "GET", uri: "https://crm.example.com", headers: {} },
    statusCode: 200,
    headers: {},
    content: { id: 1 },
    authorization: null,
  });

describe("the run of an instance on the engine", () => {
  let app: INestApplicationContext;
  let spans: RecordedSpans;

  async function started(
    runs: ScriptedRuns,
    performer: ScriptedPerformer | TimedPerformer = new ScriptedPerformer(
      responded,
    ),
    engine: RecordingEngine = new RecordingEngine(),
    generation = 1,
  ): Promise<WorkflowWorker> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        WorkflowsModule.forRoot({
          worker: { enabled: false },
          allowInMemoryStorage: true,
          retry: { attempts: 2, backoff: { delay: 0 } },
        }),
      ],
      providers: [
        OpenWorkflowRun,
        { provide: RunController, useValue: runs },
        { provide: EffectClient, useValue: performer },
        { provide: EngineRunGateway, useValue: engine },
      ],
    }).compile();
    app = await moduleRef.init();
    const input = { instanceId: "instance-1", generation };
    const id = `run:instance-1:${String(generation)}`;
    await app.get(WorkflowClient).start(EngineRunGateway.RUN, input, { id });
    return app.get(WorkflowWorker);
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    spans = new RecordedSpans();
  });

  afterEach(async () => {
    await app.close();
    await spans.stop();
  });

  it("performs_a_call_and_answers_it_by_its_effect_id", async () => {
    const agenda = {
      ended: false,
      calls: [aCall("/do/0/fetch")],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const runs = new ScriptedRuns(agenda);
    const worker = await started(runs);

    await worker.drain();

    expect(runs.answers).toEqual(["/do/0/fetch:responded"]);
  });

  it("answers_a_timer_elapsed_once_its_instant_has_come", async () => {
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [answeredAt("/do/0/pause", T0 + 30_000, "elapsed")],
    };
    const runs = new ScriptedRuns(agenda);
    const worker = await started(runs);
    await worker.drain();
    const early = runs.answers.slice();

    vi.setSystemTime(T0 + 30_000);
    await worker.drain();

    expect(early).toEqual([]);
    expect(runs.answers).toEqual(["/do/0/pause:elapsed"]);
  });

  it("answers_a_receive_with_the_message_received_before_it_waits", async () => {
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: ["/do/0/orders@message[0]"],
      waits: [],
    };
    const runs = new ScriptedRuns(agenda, ENDED, ENDED);
    const worker = await started(runs);

    await worker.drain();

    expect(runs.receipts).toBe(1);
    expect(runs.reads).toBe(0);
    expect(runs.answers).toEqual([]);
  });

  it("answers_a_receive_closed_once_its_window_has_closed", async () => {
    const receive = "/do/0/orders@message[0]";
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: [receive],
      waits: [answeredAt(receive, T0 + 10_000, "closed")],
    };
    const runs = new ScriptedRuns(agenda);
    const worker = await started(runs);
    await worker.drain();
    const early = runs.answers.slice();

    vi.setSystemTime(T0 + 10_000);
    await worker.drain();

    expect(early).toEqual([]);
    expect(runs.receipts).toBe(1);
    expect(runs.answers).toEqual(["/do/0/orders@message[0]:closed"]);
  });

  it("answers_a_wait_expired_once_its_deadline_has_passed", async () => {
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [answeredAt("/do/0/heard@event[0]", T0 + 10_000, "expired")],
    };
    const runs = new ScriptedRuns(agenda);
    const worker = await started(runs);
    await worker.drain();

    vi.setSystemTime(T0 + 10_000);
    await worker.drain();

    expect(runs.answers).toEqual(["/do/0/heard@event[0]:expired"]);
  });

  it("a_later_generation_answers_the_children_that_ended_before_it_began", async () => {
    const runs = new ScriptedRuns(ENDED);
    const worker = await started(
      runs,
      new ScriptedPerformer(responded),
      new RecordingEngine(),
      2,
    );

    await worker.drain();

    expect(runs.reads).toBe(1);
  });

  it("reads_its_agenda_again_when_woken_by_a_control_or_an_offered_event", async () => {
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const runs = new ScriptedRuns(agenda);
    const worker = await started(runs);
    await worker.drain();

    await app
      .get(WorkflowClient)
      .signal(EngineRunGateway.WAKE, null, { key: "instance-1" });
    await worker.drain();

    expect(runs.reads).toBe(1);
    expect(runs.answers).toEqual([]);
  });

  it("fails_its_instance_when_the_interpreter_runs_out_of_time_or_memory", async () => {
    const agenda = {
      ended: false,
      calls: [aCall("/do/0/fetch")],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const runs = new ExhaustedRuns(agenda);
    const worker = await started(runs);

    await worker.drain();

    expect(runs.responses).toBe(1);
    expect(runs.failed).toEqual(["instance-1"]);
  });

  it("answers_calls_in_the_order_they_completed", async () => {
    const agenda = {
      ended: false,
      calls: [aCall("a"), aCall("b"), aCall("c")],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const runs = new ScriptedRuns(agenda);
    const timed = new TimedPerformer({ a: 30, b: 20, c: 10 });
    const worker = await started(runs, timed);

    await worker.drain();

    expect(runs.answers).toEqual(["c:responded", "b:responded", "a:responded"]);
  });

  it("continues_in_the_next_generation_once_the_results_pass_the_byte_budget", async () => {
    const agenda = {
      ended: false,
      calls: [aCall("/do/0/fetch")],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const runs = new ScriptedRuns(agenda, agenda);
    const large = (): Promise<EffectOutcome> =>
      Promise.resolve({
        kind: "responded",
        request: { method: "GET", uri: "https://crm.example.com", headers: {} },
        statusCode: 200,
        headers: {},
        content: "x".repeat(6_000_000),
        authorization: null,
      });
    const engine = new RecordingEngine();
    const worker = await started(runs, new ScriptedPerformer(large), engine);

    await worker.drain();

    expect(runs.answers).toEqual(["/do/0/fetch:responded"]);
    expect(engine.continued).toEqual(["instance-1:2"]);
  });

  it("performs_the_calls_a_concurrent_turn_added_instead_of_sleeping_on_them", async () => {
    const waiting = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: ["/fork/0/orders@message[0]"],
      waits: [],
    };
    const called = {
      ended: false,
      calls: [aCall("/fork/1/fetch")],
      processes: [],
      detached: [],
      children: [],
      receives: ["/fork/0/orders@message[0]"],
      waits: [],
    };
    const runs = new ScriptedRuns(waiting, ENDED, called);
    const worker = await started(runs);

    await worker.drain();

    expect(runs.receipts).toBe(1);
    expect(runs.answers).toEqual(["/fork/1/fetch:responded"]);
  });

  it("traces_an_execution_as_one_consumer_span_without_a_span_per_step", async () => {
    const agenda = {
      ended: false,
      calls: [aCall("/do/0/fetch")],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const worker = await started(new ScriptedRuns(agenda));

    await worker.drain();

    const execution = spans.only("execute open-workflow");
    const names = spans.all().map((span) => span.name);
    expect(execution.kind).toBe(SpanKind.CONSUMER);
    expect(execution.attributes).toEqual({
      "tenon.workflow": "open-workflow",
      "tenon.instance.id": "instance-1",
      "tenon.workflow.generation": 1,
    });
    expect(names).toEqual(["execute open-workflow"]);
  });

  it("ends_an_execution_its_wait_interrupts_without_marking_it_an_error", async () => {
    const agenda = {
      ended: false,
      calls: [],
      processes: [],
      detached: [],
      children: [],
      receives: [],
      waits: [],
    };
    const worker = await started(new ScriptedRuns(agenda));
    await worker.drain();

    await app
      .get(WorkflowClient)
      .signal(EngineRunGateway.WAKE, null, { key: "instance-1" });
    await worker.drain();

    const executions = spans.named("execute open-workflow");
    expect(executions.map((span) => span.status.code)).toEqual([
      SpanStatusCode.UNSET,
      SpanStatusCode.UNSET,
    ]);
    expect(executions.flatMap((span) => span.events)).toEqual([]);
  });
});
