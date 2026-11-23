import { AnswerChildren } from "../../../../../src/application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../../../../src/application/automation/instances/answer-receives.js";
import { BeginRun } from "../../../../../src/application/automation/instances/begin-run.js";
import { CancelInstance } from "../../../../../src/application/automation/instances/cancel-instance.js";
import { FailRun } from "../../../../../src/application/automation/instances/fail-run.js";
import type {
  InputProblem,
  Receipt,
} from "../../../../../src/application/automation/instances/interfaces.js";
import { OfferEvent } from "../../../../../src/application/automation/instances/offer-event.js";
import {
  ReceivedMessages,
  WorkflowRuntime,
} from "../../../../../src/application/automation/instances/ports.js";
import { RespondToEffect } from "../../../../../src/application/automation/instances/respond-to-effect.js";
import { ResumeInstance } from "../../../../../src/application/automation/instances/resume-instance.js";
import { SuspendInstance } from "../../../../../src/application/automation/instances/suspend-instance.js";
import type { EventStore } from "../../../../../src/application/automation/events/ports.js";
import {
  CancelReason,
  EffectKind,
  InboundKind,
  InstanceEventKind,
  Phase,
  TriggerKind,
  TurnStatus,
  WaitEnd,
  WaitKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type {
  AwaitedEffect,
  EffectAnswer,
  PlayedTurn,
  RunEnding,
  RunTurn,
} from "../../../../../src/domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import {
  aCall,
  aCancelledEnding,
  aFaultedEnding,
  aListen,
  aTimer,
  aTurn,
} from "../../../../support/builders.js";
import {
  anInstanceIn,
  RecordingInstanceEvents,
  StoredSecrets,
  StoredWorkflowInstanceRepository,
  FakeUnitOfWork,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();

class ScriptedRuntime extends WorkflowRuntime {
  readonly calls: string[] = [];

  constructor(private readonly turn: PlayedTurn) {
    super();
  }

  begin(): Promise<RunTurn> {
    this.calls.push("begin");

    if (this.turn.status === TurnStatus.Stranded)
      throw new Error("A run begins on the build that starts it");

    return Promise.resolve(this.turn);
  }

  respond(
    _instance: WorkflowInstance,
    answer: EffectAnswer,
  ): Promise<PlayedTurn> {
    return Promise.resolve(this.#played(`respond ${answer.effectId}`));
  }

  offer(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("offer"));
  }

  receive(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("receive"));
  }

  answerChild(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("answerChild"));
  }

  suspend(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("suspend"));
  }

  resume(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("resume"));
  }

  cancel(): Promise<PlayedTurn> {
    return Promise.resolve(this.#played("cancel"));
  }

  accepts(): Promise<boolean> {
    this.calls.push("accepts");
    return Promise.resolve(true);
  }

  inputProblemsOf(): Promise<readonly InputProblem[]> {
    return Promise.resolve([]);
  }

  faultedEnding(): Promise<RunEnding> {
    this.calls.push("faultedEnding");
    return Promise.resolve(aFaultedEnding());
  }

  childOf(): never {
    throw new Error("A run answers no child here");
  }

  eventOf(): never {
    throw new Error("A run emits no event here");
  }

  outcomeOf(): never {
    throw new Error("A run answers no effect here");
  }

  #played(call: string): PlayedTurn {
    this.calls.push(call);
    return this.turn;
  }
}

class StoredMessages extends ReceivedMessages {
  readonly forgotten: string[] = [];

  append(): Promise<number | null> {
    return Promise.resolve(0);
  }

  awaitedBy(instance: WorkflowInstance): Promise<readonly Receipt[]> {
    const message = { payload: { order: 1 }, headers: {}, correlationId: null };
    const inbound = { kind: InboundKind.Message as const, message };
    const receipts = instance.waits.map((wait) => ({ wait, inbound }));
    return Promise.resolve(receipts);
  }

  forget(
    _instance: WorkflowInstance,
    receipts: readonly Receipt[],
  ): Promise<void> {
    for (const receipt of receipts) this.forgotten.push(receipt.wait.effectId);

    return Promise.resolve();
  }
}

const aReceive = (id: string, execution: string): AwaitedEffect => ({
  id,
  kind: EffectKind.Receive,
  request: { id, kind: "asyncapi", deadline: null },
  wait: {
    effectId: id,
    kind: WaitKind.Message,
    until: null,
    stream: null,
    retryOf: null,
    execution,
    position: 0,
    deadlines: [],
  },
});

const aChild = (id: string): AwaitedEffect => ({
  id,
  kind: EffectKind.Child,
  request: { id, kind: "workflow", await: true, deadline: 5_000 },
  wait: {
    effectId: id,
    kind: WaitKind.Child,
    until: 5_000,
    stream: null,
    retryOf: null,
    execution: null,
    position: null,
    deadlines: [{ at: 5_000, end: WaitEnd.Expired }],
  },
});

const aHeard = (id: string): AwaitedEffect => ({
  id,
  kind: EffectKind.Listen,
  request: { id, kind: "listen", deadline: null },
  wait: {
    effectId: id,
    kind: WaitKind.Event,
    until: null,
    stream: "/do/0/heard/listen/to|stream",
    retryOf: null,
    execution: null,
    position: null,
    deadlines: [],
  },
});

const signal = new AbortController().signal;

const ACCEPTED = {
  sequence: 7,
  eventId: "event-7",
  type: "com.example.order",
  cloudEvent: { id: "event-7", source: "/orders", type: "com.example.order" },
  acceptedAt: new Date(0),
  lifecycleOf: null,
};

function storedEvent(): EventStore {
  const store = { find: () => Promise.resolve(ACCEPTED) };
  return store as unknown as EventStore;
}

function setUp(instance: WorkflowInstance, turn: PlayedTurn) {
  const instances = new StoredWorkflowInstanceRepository(instance);
  const runtime = new ScriptedRuntime(turn);
  const secrets = new StoredSecrets();
  const events = new RecordingInstanceEvents(instances);
  return {
    instances,
    runtime,
    events,
    begin: new BeginRun(instances, runtime, secrets, events, unitOfWork),
    respond: new RespondToEffect(
      instances,
      runtime,
      secrets,
      events,
      unitOfWork,
    ),
    suspend: new SuspendInstance(
      instances,
      runtime,
      secrets,
      events,
      unitOfWork,
    ),
    resume: new ResumeInstance(instances, runtime, secrets, events, unitOfWork),
    cancel: new CancelInstance(instances, runtime, secrets, events, unitOfWork),
    fail: new FailRun(instances, runtime, events, unitOfWork),
    offer: new OfferEvent(
      instances,
      storedEvent(),
      runtime,
      secrets,
      events,
      unitOfWork,
    ),
    answerChildren: new AnswerChildren(
      instances,
      runtime,
      secrets,
      events,
      unitOfWork,
    ),
  };
}

async function awaitedOf(
  instances: StoredWorkflowInstanceRepository,
  instanceId: string,
): Promise<readonly string[]> {
  const stored = await instances.find(instanceId);
  const awaited = stored?.agenda.awaited ?? [];
  return awaited.map((effect) => effect.id);
}

async function aBegunInstance(): Promise<WorkflowInstance> {
  const pending = anInstanceIn(Phase.Pending);
  const firstTurn = aTurn({
    requested: [aCall("/do/0/fetch"), aTimer("/do/1/pause")],
  });
  const fixture = setUp(pending, firstTurn);
  await fixture.begin.execute({ instanceId: pending.id, signal });
  const begun = await fixture.instances.find(pending.id);

  if (begun === null) throw new Error("the instance was not stored");

  return begun;
}

describe("a run begun from its start", () => {
  it("dispatches_a_request_for_each_effect_the_world_performs_and_a_timer_for_each_deadline", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      requested: [
        aCall("/do/0/fetch"),
        aTimer("/do/1/pause", 30_000),
        aChild("/do/2/child"),
        aHeard("/do/3/heard"),
        aReceive("/do/4/orders@message[0]", "/do/4/orders"),
      ],
    });
    const fixture = setUp(pending, turn);

    await fixture.begin.execute({ instanceId: pending.id, signal });

    expect(fixture.events.dispatched).toEqual([
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: pending.id,
        effectId: "/do/0/fetch",
      },
      {
        kind: InstanceEventKind.TimerSet,
        instanceId: pending.id,
        effectId: "/do/1/pause",
        at: 30_000,
      },
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: pending.id,
        effectId: "/do/2/child",
      },
      {
        kind: InstanceEventKind.TimerSet,
        instanceId: pending.id,
        effectId: "/do/2/child",
        at: 5_000,
      },
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: pending.id,
        effectId: "/do/4/orders@message[0]",
      },
    ]);
  });

  it("requests_no_effect_its_own_turn_withdrew", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      requested: [aCall("/do/0/fetch")],
      withdrawn: ["/do/0/fetch"],
    });
    const fixture = setUp(pending, turn);

    await fixture.begin.execute({ instanceId: pending.id, signal });

    expect(fixture.events.kindsOf(pending.id)).toEqual([]);
    expect(fixture.events.calls).toEqual([pending.id]);
  });

  it("a_turn_that_ends_the_run_requests_nothing_and_dispatches_its_end", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      status: TurnStatus.Faulted,
      requested: [aCall("/do/0/fetch")],
    });
    const fixture = setUp(pending, turn);

    await fixture.begin.execute({ instanceId: pending.id, signal });

    expect(fixture.events.kindsOf(pending.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });

  it("a_begin_repeated_after_a_crash_plays_and_dispatches_nothing", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, aTurn());

    await fixture.begin.execute({ instanceId: instance.id, signal });

    expect(fixture.runtime.calls).toEqual([]);
    expect(fixture.events.calls).toEqual([]);
  });

  it("a_run_of_an_instance_that_is_gone_plays_nothing", async () => {
    const fixture = setUp(anInstanceIn(Phase.Pending), aTurn());

    await fixture.begin.execute({ instanceId: "gone", signal });

    expect(fixture.runtime.calls).toEqual([]);
  });
});

describe("a run answered by effect id", () => {
  it("an_awaited_effect_is_answered_by_its_id_and_the_run_advances", async () => {
    const instance = await aBegunInstance();
    const turn = aTurn({ answered: ["/do/0/fetch"] });
    const fixture = setUp(instance, turn);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "emitted" } };

    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    const awaited = await awaitedOf(fixture.instances, instance.id);
    expect(fixture.runtime.calls).toEqual(["respond /do/0/fetch"]);
    expect(awaited).toEqual(["/do/1/pause"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Waiting);
    expect(fixture.events.calls).toEqual([instance.id]);
  });

  it("an_answer_repeated_after_a_crash_never_reaches_the_interpreter", async () => {
    const instance = await aBegunInstance();
    const turn = aTurn({ answered: ["/do/0/fetch"] });
    const fixture = setUp(instance, turn);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "emitted" } };
    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    expect(fixture.runtime.calls).toEqual(["respond /do/0/fetch"]);
    expect(fixture.events.calls).toEqual([instance.id]);
  });

  it("an_answer_that_requests_the_next_effect_dispatches_its_request", async () => {
    const instance = await aBegunInstance();
    const turn = aTurn({
      answered: ["/do/0/fetch"],
      requested: [aCall("/do/2/notify")],
    });
    const fixture = setUp(instance, turn);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "responded" } };

    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    expect(fixture.events.dispatched).toEqual([
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: instance.id,
        effectId: "/do/2/notify",
      },
    ]);
  });
});

describe("suspension, resumption, cancellation and failure", () => {
  it("a_suspension_is_the_interpreters_turn_and_dispatches_it", async () => {
    const instance = await aBegunInstance();
    const suspended = aTurn({ status: TurnStatus.Suspended });
    const fixture = setUp(instance, suspended);

    const result = await fixture.suspend.execute({ instanceId: instance.id });

    expect(result.ok).toBe(true);
    expect(fixture.runtime.calls).toEqual(["suspend"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Suspended);
    expect(fixture.events.calls).toEqual([instance.id]);
  });

  it("a_resumption_runs_the_instance_again_and_dispatches_its_turn", async () => {
    const instance = await aBegunInstance();
    const suspended = aTurn({ status: TurnStatus.Suspended });
    const suspending = setUp(instance, suspended);
    await suspending.suspend.execute({ instanceId: instance.id });
    const stored = await suspending.instances.find(instance.id);
    const resumed = aTurn({ requested: [aCall("/do/2/notify")] });
    const fixture = setUp(stored ?? instance, resumed);

    await fixture.resume.execute({ instanceId: instance.id });

    expect(fixture.runtime.calls).toEqual(["resume"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Running);
    expect(fixture.events.kindsOf(instance.id)).toEqual([
      InstanceEventKind.EffectRequested,
    ]);
  });

  it("a_running_instance_is_cancelled_by_the_interpreters_turn_and_its_end_dispatched", async () => {
    const instance = await aBegunInstance();
    const cancelled = aTurn({ status: TurnStatus.Cancelled });
    const fixture = setUp(instance, cancelled);

    await fixture.cancel.execute({ instanceId: instance.id, signal: null });

    expect(fixture.runtime.calls).toEqual(["cancel"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Cancelled);
    expect(fixture.events.kindsOf(instance.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });

  it("a_pending_instance_is_cancelled_without_the_interpreter_and_its_end_dispatched", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const fixture = setUp(pending, aTurn());

    await fixture.cancel.execute({ instanceId: pending.id, signal: null });

    expect(fixture.runtime.calls).toEqual([]);
    expect(fixture.instances.phaseOf(pending.id)).toBe(Phase.Cancelled);
    expect(fixture.events.kindsOf(pending.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });

  it("a_failed_run_is_faulted_and_its_end_dispatched", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, aTurn());

    await fixture.fail.execute({ instanceId: instance.id });

    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Faulted);
    expect(fixture.events.kindsOf(instance.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });
});

describe("an event offered to a listening run", () => {
  it("is_taken_by_the_interpreters_turn_and_dispatched", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const listening = aTurn({
      requested: [aHeard("/do/0/heard")],
      listening: [aListen("/do/0/heard", "/do/0/heard")],
    });
    const begun = setUp(pending, listening);
    await begun.begin.execute({ instanceId: pending.id, signal });
    const stored = await begun.instances.find(pending.id);
    const taken = aTurn({ answered: ["/do/0/heard"] });
    const fixture = setUp(stored ?? pending, taken);

    await fixture.offer.execute({
      instanceId: pending.id,
      sequence: 7,
      candidates: ["/do/0/heard"],
      signal,
    });

    expect(fixture.runtime.calls).toEqual(["offer"]);
    expect(fixture.events.calls).toEqual([pending.id]);
  });
});

describe("a run this build of the interpreter cannot continue", () => {
  const stranded: PlayedTurn = {
    status: TurnStatus.Stranded,
    ending: aCancelledEnding(),
  };

  it("an_answer_that_meets_it_cancels_it_for_the_interpreters_change_and_does_not_fault_it", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, stranded);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "emitted" } };

    await fixture.respond.execute({ instanceId: instance.id, answer, signal });
    const stored = await fixture.instances.find(instance.id);

    expect(stored?.agenda.awaited).toEqual([]);
    expect(stored?.phase).toBe(Phase.Cancelled);
    expect(stored?.cancelReason).toBe(CancelReason.InterpreterChanged);
  });

  it("a_suspension_that_meets_it_cancels_it_and_dispatches_its_end", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, stranded);

    const result = await fixture.suspend.execute({ instanceId: instance.id });

    expect(result.ok).toBe(true);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Cancelled);
    expect(fixture.events.kindsOf(instance.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });
});

describe("children answered by their parent's own run", () => {
  const CHILD = "/do/2/lines[0]/do/0/price";

  function endedChildOf(parent: WorkflowInstance): WorkflowInstance {
    return anInstanceIn(Phase.Completed, {
      id: "child-1",
      trigger: TriggerKind.Parent,
      originId: parent.id,
      originEffectId: CHILD,
    });
  }

  it("a_child_that_ends_before_its_parent_awaits_it_is_answered_once_it_does", async () => {
    const parent = await aBegunInstance();
    const child = endedChildOf(parent);
    const awaiting = aTurn({ requested: [aChild(CHILD)] });
    const fixture = setUp(parent, awaiting);
    fixture.instances.put(child);

    await fixture.answerChildren.execute({ instanceId: parent.id, signal });
    await fixture.respond.execute({
      instanceId: parent.id,
      answer: { effectId: "/do/0/fetch", outcome: { kind: "responded" } },
      signal,
    });
    await fixture.answerChildren.execute({ instanceId: parent.id, signal });

    expect(fixture.runtime.calls).toEqual([
      "respond /do/0/fetch",
      "answerChild",
    ]);
    expect(fixture.events.calls).toEqual([parent.id, parent.id]);
  });

  it("a_parent_whose_awaited_children_have_not_ended_is_read_without_a_write", async () => {
    const parent = await aBegunInstance();
    const fixture = setUp(parent, aTurn());
    const saves = fixture.instances.saves;

    await fixture.answerChildren.execute({ instanceId: parent.id, signal });

    expect(fixture.runtime.calls).toEqual([]);
    expect(fixture.instances.saves).toBe(saves);
  });

  it("an_ended_parent_is_not_answered_by_its_child", async () => {
    const parent = anInstanceIn(Phase.Cancelled);
    const child = endedChildOf(parent);
    const fixture = setUp(parent, aTurn());
    fixture.instances.put(child);

    await fixture.answerChildren.execute({ instanceId: parent.id, signal });

    expect(fixture.runtime.calls).toEqual([]);
  });
});

describe("receives answered from the stored messages", () => {
  it("a_receipt_whose_receive_an_earlier_answer_ended_never_reaches_the_interpreter", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const both = aTurn({
      requested: [
        aReceive("/fork/0/a@message[0]", "/fork/0/a"),
        aReceive("/fork/1/b@message[0]", "/fork/1/b"),
      ],
    });
    const begun = setUp(pending, both);
    await begun.begin.execute({ instanceId: pending.id, signal });
    const completed = aTurn({
      status: TurnStatus.Completed,
      answered: ["/fork/0/a@message[0]"],
      withdrawn: ["/fork/1/b@message[0]"],
    });
    const fixture = setUp(pending, completed);
    const stored = await begun.instances.find(pending.id);

    if (stored === null) throw new Error("the instance was not stored");

    fixture.instances.put(stored);
    const messages = new StoredMessages();
    const answer = new AnswerReceives(
      fixture.instances,
      messages,
      fixture.runtime,
      new StoredSecrets(),
      fixture.events,
      unitOfWork,
    );

    await answer.execute({ instanceId: pending.id, signal });

    expect(fixture.runtime.calls).toEqual(["receive"]);
    expect(messages.forgotten).toEqual(["/fork/0/a@message[0]"]);
    expect(fixture.instances.phaseOf(pending.id)).toBe(Phase.Completed);
    expect(fixture.events.kindsOf(pending.id)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });
});
