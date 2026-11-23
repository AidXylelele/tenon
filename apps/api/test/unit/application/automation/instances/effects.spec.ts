import type { EventOrigin } from "../../../../../src/application/automation/events/enums.js";
import type { EventStore } from "../../../../../src/application/automation/events/ports.js";
import { AnswerTimer } from "../../../../../src/application/automation/instances/answer-timer.js";
import { EmitForEffect } from "../../../../../src/application/automation/instances/emit-for-effect.js";
import type { EffectResult } from "../../../../../src/application/automation/instances/enums.js";
import { GiveUpEffect } from "../../../../../src/application/automation/instances/give-up-effect.js";
import type {
  ChildRequest,
  EffectCall,
  Receipt,
} from "../../../../../src/application/automation/instances/interfaces.js";
import { PerformEffect } from "../../../../../src/application/automation/instances/perform-effect.js";
import {
  EffectClient,
  ReceivedMessages,
  type WorkflowRuntime,
} from "../../../../../src/application/automation/instances/ports.js";
import { ReceiveForEffect } from "../../../../../src/application/automation/instances/receive-for-effect.js";
import { StartChildForEffect } from "../../../../../src/application/automation/instances/start-child-for-effect.js";
import { StartDetachedProcess } from "../../../../../src/application/automation/instances/start-detached-process.js";
import {
  EffectKind,
  InboundKind,
  InstanceEventKind,
  Phase,
  TriggerKind,
  WaitEnd,
  WaitKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { AwaitedEffect } from "../../../../../src/domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../../../src/domain/automation/interfaces.js";
import { RunSecrets } from "../../../../../src/domain/automation/secrets/run-secrets.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDefinition, aTimer, aTurn } from "../../../../support/builders.js";
import {
  anInstanceIn,
  FakeUnitOfWork,
  RecordingInstanceEvents,
  RecordingInstanceRuns,
  StoredSecrets,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  T0,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();
const signal = new AbortController().signal;
const name = new WorkflowName("sales", "route-lead");

const anEffect = (
  id: string,
  kind: EffectKind,
  request: JsonObject = { id },
): AwaitedEffect => ({ id, kind, request, wait: null });

const aClosingReceive = (id: string): AwaitedEffect => ({
  id,
  kind: EffectKind.Receive,
  request: { id },
  wait: {
    effectId: id,
    kind: WaitKind.Message,
    until: 20_000,
    stream: null,
    retryOf: null,
    execution: "/do/0/orders",
    position: 0,
    deadlines: [
      { at: 20_000, end: WaitEnd.Expired },
      { at: 10_000, end: WaitEnd.Closed },
    ],
  },
});

class RecordingPerformer extends EffectClient {
  readonly performed: string[] = [];
  readonly detached: string[] = [];
  readonly keys: string[] = [];

  perform(request: JsonObject, call: EffectCall): Promise<JsonObject> {
    this.performed.push(JSON.stringify(request.id));
    this.keys.push(call.idempotencyKey);
    return Promise.resolve({ kind: "responded", statusCode: 200 });
  }

  performDetached(request: JsonObject, call: EffectCall): Promise<void> {
    this.detached.push(JSON.stringify(request.id));
    this.keys.push(call.idempotencyKey);
    return Promise.resolve();
  }
}

class StoredReceipts extends ReceivedMessages {
  constructor(private readonly stored: boolean) {
    super();
  }

  append(): Promise<number | null> {
    return Promise.resolve(0);
  }

  awaitedBy(instance: WorkflowInstance): Promise<readonly Receipt[]> {
    if (!this.stored) return Promise.resolve([]);

    const message = { payload: null, headers: {}, correlationId: null };
    const inbound = { kind: InboundKind.Message as const, message };
    const receipts = instance.waits.map((wait) => ({ wait, inbound }));
    return Promise.resolve(receipts);
  }

  forget(): Promise<void> {
    return Promise.resolve();
  }
}

interface Accepted {
  readonly event: JsonObject;
  readonly origin: EventOrigin;
}

class AcceptingEvents {
  readonly accepted: Accepted[] = [];

  accept(event: JsonObject, origin: EventOrigin): Promise<number | null> {
    this.accepted.push({ event, origin });
    return Promise.resolve(1);
  }
}

function runtimeOf(child: ChildRequest): WorkflowRuntime {
  const runtime = {
    childOf: () => child,
    eventOf: (request: JsonObject) => request.event as JsonObject,
    outcomeOf: (result: EffectResult | WaitEnd) => ({ kind: result }),
  };
  return runtime as unknown as WorkflowRuntime;
}

function aChildRequest(trigger: TriggerKind, workflow = name): ChildRequest {
  const input: JsonValue = { line: 1 };
  return { name: workflow, version: null, input, trigger };
}

async function setUp(
  awaited: readonly AwaitedEffect[],
  child: ChildRequest = aChildRequest(TriggerKind.Parent),
  stored = true,
) {
  const parent = anInstanceIn(Phase.Pending, { id: "parent-1" });
  parent.begin(aTurn({ requested: awaited }), RunSecrets.of([]), T0);
  parent.clearEvents();
  const instances = new StoredWorkflowInstanceRepository(parent);
  const workflows = new StoredWorkflowRepository();
  const workflow = Workflow.register(name);
  const definition = aDefinition({}, "content-1");
  workflow.publish({ definition, source: null, publisherId: "a-1", now: T0 });
  await workflows.save(workflow);
  const secrets = new StoredSecrets();
  const events = new RecordingInstanceEvents(instances);
  const runs = new RecordingInstanceRuns();
  const performer = new RecordingPerformer();
  const runtime = runtimeOf(child);
  const accepted = new AcceptingEvents();
  const store = accepted as unknown as EventStore;
  const receipts = new StoredReceipts(stored);
  return {
    instances,
    events,
    runs,
    performer,
    accepted,
    perform: new PerformEffect(instances, secrets, performer, runs, unitOfWork),
    detach: new StartDetachedProcess(
      instances,
      secrets,
      performer,
      runtime,
      runs,
      unitOfWork,
    ),
    startChild: new StartChildForEffect(
      workflows,
      instances,
      runtime,
      events,
      runs,
      unitOfWork,
    ),
    emit: new EmitForEffect(
      instances,
      secrets,
      runtime,
      store,
      runs,
      unitOfWork,
    ),
    timer: new AnswerTimer(instances, runtime, runs, unitOfWork),
    receive: new ReceiveForEffect(instances, receipts, runs, unitOfWork),
    giveUp: new GiveUpEffect(instances, runs, unitOfWork),
  };
}

function commandOf(effectId: string) {
  return { instanceId: "parent-1", effectId, signal };
}

describe("an effect the world performs", () => {
  it("is_performed_under_a_key_stable_across_redeliveries_and_answered_with_its_outcome", async () => {
    const fixture = await setUp([anEffect("/do/0/fetch", EffectKind.Call)]);
    const command = commandOf("/do/0/fetch");

    await fixture.perform.execute(command);

    expect(fixture.performer.performed).toEqual(['"/do/0/fetch"']);
    expect(fixture.performer.keys).toEqual(["parent-1:/do/0/fetch"]);
    expect(fixture.runs.responded).toEqual([
      {
        instanceId: "parent-1",
        answer: {
          effectId: "/do/0/fetch",
          outcome: { kind: "responded", statusCode: 200 },
        },
      },
    ]);
  });

  it("is_not_performed_for_a_run_that_has_ended", async () => {
    const fixture = await setUp([anEffect("/do/0/fetch", EffectKind.Call)]);
    const stored = await fixture.instances.find("parent-1");
    stored?.cancel(T0);

    if (stored) await fixture.instances.save(stored);

    const command = commandOf("/do/0/fetch");

    await fixture.perform.execute(command);

    expect(fixture.performer.performed).toEqual([]);
    expect(fixture.runs.responded).toEqual([]);
  });

  it("a_detached_process_is_performed_then_answered_started", async () => {
    const effect = anEffect("/do/0/report", EffectKind.Detached);
    const fixture = await setUp([effect]);
    const command = commandOf("/do/0/report");

    await fixture.detach.execute(command);

    expect(fixture.performer.detached).toEqual(['"/do/0/report"']);
    expect(fixture.runs.responded[0]?.answer).toEqual({
      effectId: "/do/0/report",
      outcome: { kind: "started" },
    });
  });

  it("an_effect_given_up_on_fails_the_run_once_it_is_still_awaited", async () => {
    const fixture = await setUp([anEffect("/do/0/fetch", EffectKind.Call)]);
    const awaited = commandOf("/do/0/fetch");
    const gone = commandOf("/do/9/gone");

    await fixture.giveUp.execute(awaited);
    await fixture.giveUp.execute(gone);

    expect(fixture.runs.failed).toEqual(["parent-1"]);
  });
});

describe("a child a run asks for", () => {
  const CHILD = "/do/0/price";

  it("an_awaited_child_is_started_with_its_run_dispatched_and_left_unanswered", async () => {
    const fixture = await setUp([anEffect(CHILD, EffectKind.Child)]);
    const command = commandOf(CHILD);

    await fixture.startChild.execute(command);

    const child = fixture.events.started[0]?.instance;
    expect(child?.originId).toBe("parent-1");
    expect(child?.originEffectId).toBe(CHILD);
    expect(child?.trigger).toBe(TriggerKind.Parent);
    expect(fixture.events.started[0]?.stored).toBe(true);
    expect(fixture.runs.responded).toEqual([]);
  });

  it("a_detached_child_is_started_and_answered_started", async () => {
    const detached = aChildRequest(TriggerKind.Detached);
    const fixture = await setUp([anEffect(CHILD, EffectKind.Child)], detached);
    const command = commandOf(CHILD);

    await fixture.startChild.execute(command);

    expect(fixture.events.started).toHaveLength(1);
    expect(fixture.runs.responded[0]?.answer.outcome).toEqual({
      kind: "started",
    });
  });

  it("a_repeat_starts_no_second_child", async () => {
    const fixture = await setUp([anEffect(CHILD, EffectKind.Child)]);
    const command = commandOf(CHILD);

    await fixture.startChild.execute(command);
    await fixture.startChild.execute(command);

    expect(fixture.events.started).toHaveLength(1);
  });

  it("an_unknown_workflow_is_answered_missing", async () => {
    const unknown = new WorkflowName("sales", "nobody");
    const request = aChildRequest(TriggerKind.Parent, unknown);
    const fixture = await setUp([anEffect(CHILD, EffectKind.Child)], request);
    const command = commandOf(CHILD);

    await fixture.startChild.execute(command);

    expect(fixture.events.started).toEqual([]);
    expect(fixture.runs.responded[0]?.answer.outcome).toEqual({
      kind: "missing",
    });
  });
});

describe("an event a run emits", () => {
  it("is_accepted_as_emitted_and_answered_emitted", async () => {
    const event = { id: "e-1", source: "/runs", type: "com.example.done" };
    const effect = anEffect("/do/0/tell", EffectKind.Emit, { event });
    const fixture = await setUp([effect]);
    const command = commandOf("/do/0/tell");

    await fixture.emit.execute(command);

    expect(fixture.accepted.accepted.map((each) => each.event)).toEqual([
      event,
    ]);
    expect(fixture.runs.responded[0]?.answer.outcome).toEqual({
      kind: "emitted",
    });
  });
});

describe("a timer a run set", () => {
  it("answers_the_wait_that_ended_first_at_its_instant", async () => {
    const fixture = await setUp([aClosingReceive("/do/0/orders@message[0]")]);

    await fixture.timer.execute({
      instanceId: "parent-1",
      effectId: "/do/0/orders@message[0]",
      at: 10_000,
    });

    expect(fixture.runs.responded[0]?.answer).toEqual({
      effectId: "/do/0/orders@message[0]",
      outcome: { kind: WaitEnd.Closed },
    });
  });

  it("answers_nothing_for_a_wait_already_answered", async () => {
    const fixture = await setUp([aTimer("/do/0/pause", 1_000)]);

    await fixture.timer.execute({
      instanceId: "parent-1",
      effectId: "/do/9/gone",
      at: 1_000,
    });

    expect(fixture.runs.responded).toEqual([]);
  });
});

describe("a receive a run waits on", () => {
  it("asks_the_run_to_take_a_message_stored_before_it_waited", async () => {
    const effect = aClosingReceive("/do/0/orders@message[0]");
    const fixture = await setUp([effect]);
    const command = commandOf("/do/0/orders@message[0]");

    await fixture.receive.execute(command);

    expect(fixture.runs.received).toEqual(["parent-1"]);
  });

  it("asks_nothing_while_no_message_is_stored", async () => {
    const effect = aClosingReceive("/do/0/orders@message[0]");
    const fixture = await setUp([effect], undefined, false);
    const command = commandOf("/do/0/orders@message[0]");

    await fixture.receive.execute(command);

    expect(fixture.runs.received).toEqual([]);
  });
});

describe("dispatching what a child start raised", () => {
  it("dispatches_the_child_start", async () => {
    const fixture = await setUp([anEffect("/do/0/price", EffectKind.Child)]);
    const command = commandOf("/do/0/price");

    await fixture.startChild.execute(command);

    const child = fixture.events.started[0]?.instance;
    const kinds = fixture.events.kindsOf(child?.id ?? "");
    expect(kinds).toEqual([InstanceEventKind.Started]);
  });
});
