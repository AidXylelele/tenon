import {
  CancelReason,
  Control,
  EffectKind,
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  TaskValueKind,
  TriggerKind,
  TurnStatus,
  WaitEnd,
  WaitKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { AwaitedEffect } from "../../../../../src/domain/automation/instances/interfaces.js";
import { RunSecrets } from "../../../../../src/domain/automation/secrets/run-secrets.js";
import { SecretValue } from "../../../../../src/domain/automation/secrets/secret-value.js";
import {
  aCall,
  aCancelledEnding,
  aFaultedEnding,
  aListen,
  aTimer,
  aTurn,
} from "../../../../support/builders.js";
import { anInstanceIn, T0 } from "../../../../support/fakes.js";

const noSecrets = RunSecrets.of([]);
const later = new Date("2026-11-03T11:00:00.000Z");

function begun(requested = [aTimer("/do/0/pause")]) {
  const instance = anInstanceIn(Phase.Pending);
  const turn = aTurn({ requested });
  instance.begin(turn, noSecrets, T0);
  instance.clearEvents();
  return instance;
}

describe("a run begun on its first turn", () => {
  it("waits_when_everything_it_awaits_is_a_wait", () => {
    const instance = begun();

    expect(instance.phase).toBe(Phase.Waiting);
    expect(instance.awaits("/do/0/pause")).toBe(true);
  });

  it("runs_while_it_awaits_a_call", () => {
    const instance = begun([aCall("/do/0/fetch"), aTimer("/do/0/pause")]);

    expect(instance.phase).toBe(Phase.Running);
  });

  it("begins_once", () => {
    const instance = begun();
    const again = aTurn({ status: TurnStatus.Completed });

    instance.begin(again, noSecrets, later);

    expect(instance.phase).toBe(Phase.Waiting);
  });
});

const aReceiveClosing = (id: string): AwaitedEffect => ({
  id,
  kind: EffectKind.Receive,
  request: { id, kind: "asyncapi" },
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

describe("what a run asks of the world", () => {
  it("requests_each_effect_the_world_performs_and_sets_a_timer_per_deadline", () => {
    const instance = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      requested: [
        aCall("/do/0/fetch"),
        aTimer("/do/1/pause", 30_000),
        aReceiveClosing("/do/2/orders@message[0]"),
      ],
    });

    instance.begin(turn, noSecrets, T0);

    expect(instance.events).toEqual([
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: instance.id,
        effectId: "/do/0/fetch",
        effect: EffectKind.Call,
      },
      {
        kind: InstanceEventKind.TimerSet,
        instanceId: instance.id,
        effectId: "/do/1/pause",
        at: 30_000,
      },
      {
        kind: InstanceEventKind.EffectRequested,
        instanceId: instance.id,
        effectId: "/do/2/orders@message[0]",
        effect: EffectKind.Receive,
      },
      {
        kind: InstanceEventKind.TimerSet,
        instanceId: instance.id,
        effectId: "/do/2/orders@message[0]",
        at: 20_000,
      },
      {
        kind: InstanceEventKind.TimerSet,
        instanceId: instance.id,
        effectId: "/do/2/orders@message[0]",
        at: 10_000,
      },
    ]);
  });

  it("knows_the_request_of_an_effect_it_awaits", () => {
    const instance = begun([aCall("/do/0/fetch")]);

    expect(instance.requestOf("/do/0/fetch")).toEqual({
      id: "/do/0/fetch",
      kind: "http",
      deadline: null,
    });
    expect(instance.requestOf("/do/9/gone")).toBeNull();
  });

  it("asks_nothing_of_the_world_once_ended", () => {
    const instance = begun([aCall("/do/0/fetch")]);
    instance.cancel(later);

    expect(instance.requestOf("/do/0/fetch")).toBeNull();
  });

  it("tells_which_wait_ended_first_at_an_instant", () => {
    const instance = begun([aReceiveClosing("/do/2/orders@message[0]")]);

    const early = instance.waitEndAt("/do/2/orders@message[0]", 9_999);
    const closed = instance.waitEndAt("/do/2/orders@message[0]", 10_000);
    const late = instance.waitEndAt("/do/2/orders@message[0]", 25_000);

    expect(early).toBeNull();
    expect(closed).toBe(WaitEnd.Closed);
    expect(late).toBe(WaitEnd.Closed);
  });

  it("a_turn_that_ends_the_run_requests_none_of_its_effects", () => {
    const instance = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      status: TurnStatus.Faulted,
      requested: [aCall("/do/0/fetch")],
    });

    instance.begin(turn, noSecrets, T0);

    expect(instance.events.map((event) => event.kind)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });
});

describe("a turn that answers an effect", () => {
  it("leaves_the_answered_effect_out_of_what_the_run_awaits", () => {
    const instance = begun([aCall("/do/0/fetch")]);
    const turn = aTurn({
      answered: ["/do/0/fetch"],
      requested: [aTimer("/do/1/pause")],
    });

    instance.advance(turn, noSecrets, later);

    expect(instance.awaits("/do/0/fetch")).toBe(false);
    expect(instance.agenda.awaited.map((effect) => effect.id)).toEqual([
      "/do/1/pause",
    ]);
  });

  it("a_completed_turn_ends_the_instance_with_its_output_masked", () => {
    const instance = begun([aCall("/do/0/fetch")]);
    const token = { name: "token", value: new SecretValue("abcd-1234") };
    const secrets = RunSecrets.of([token]);
    const turn = aTurn({
      status: TurnStatus.Completed,
      answered: ["/do/0/fetch"],
      output: { echoed: "Bearer abcd-1234" },
    });

    instance.advance(turn, secrets, later);

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.output).toEqual({ echoed: "Bearer ***" });
    expect(instance.endedAt).toEqual(later);
    expect(instance.agenda).toEqual({
      instanceId: instance.id,
      ended: true,
      awaited: [],
    });
  });

  it("keeps_the_task_values_it_reports_with_their_secrets_masked", () => {
    const instance = begun([aCall("/do/0/fetch")]);
    const token = { name: "token", value: new SecretValue("abcd-1234") };
    const secrets = RunSecrets.of([token]);
    const output = {
      execution: "/do/0/fetch",
      kind: TaskValueKind.Output,
      value: { echoed: "Bearer abcd-1234" },
    };
    const turn = aTurn({ answered: ["/do/0/fetch"], taskValues: [output] });

    instance.advance(turn, secrets, later);

    expect(instance.taskValues).toEqual([
      {
        execution: "/do/0/fetch",
        kind: TaskValueKind.Output,
        value: { echoed: "Bearer ***" },
      },
    ]);
  });

  it("a_turn_that_withdraws_a_child_tells_its_children_they_are_abandoned", () => {
    const instance = begun([aCall("/do/0/child")]);
    const turn = aTurn({
      withdrawn: ["/do/0/child"],
      abandoned: ["/do/0/child"],
    });

    instance.advance(turn, noSecrets, later);

    expect(instance.events.map((event) => event.kind)).toEqual([
      InstanceEventKind.ChildrenAbandoned,
    ]);
  });
});

describe("an event offered to a run", () => {
  function listening() {
    const instance = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      requested: [aTimer("/do/0/heard@event[0]")],
      listening: [aListen("/do/0/heard@event[0]", "/do/0/heard")],
    });
    instance.begin(turn, noSecrets, T0);
    return instance;
  }

  it("is_taken_by_a_candidate_the_run_listens_with", () => {
    const instance = listening();
    const offer = { eventId: "e-1", event: {}, candidates: ["/do/0/heard"] };

    expect(instance.mayTake(offer)).toBe(true);
  });

  it("goes_only_to_the_listens_among_its_candidates", () => {
    const instance = listening();
    const candidates = ["/do/0/heard", "/do/9/elsewhere"];
    const offer = { eventId: "e-1", event: {}, candidates };

    const listens = instance.run?.listeningFor(offer) ?? [];

    const effects = listens.map((listen) => listen.effectId);
    expect(effects).toEqual(["/do/0/heard@event[0]"]);
  });

  it("is_not_taken_twice", () => {
    const instance = listening();
    const turn = aTurn({
      answered: ["/do/0/heard@event[0]"],
      requested: [aTimer("/do/0/heard@event[1]")],
      listening: [aListen("/do/0/heard@event[1]", "/do/0/heard")],
      taken: { eventId: "e-1", execution: "/do/0/heard" },
    });
    instance.advance(turn, noSecrets, later);
    const offer = { eventId: "e-1", event: {}, candidates: ["/do/0/heard"] };

    expect(instance.mayTake(offer)).toBe(false);
  });
});

describe("the controls of an instance", () => {
  it("a_waiting_instance_may_be_suspended_and_not_resumed", () => {
    const instance = begun();

    expect(instance.admits(Control.Suspend)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(instance.admits(Control.Resume)).toEqual({
      ok: false,
      failure: InstanceRefusal.NotSuspended,
    });
  });

  it("an_ended_instance_may_not_be_cancelled", () => {
    const instance = anInstanceIn(Phase.Completed);

    expect(instance.admits(Control.Cancel)).toEqual({
      ok: false,
      failure: InstanceRefusal.Ended,
    });
  });

  it("a_running_instance_is_not_deleted_and_tells_nobody", () => {
    const instance = begun();

    const deleted = instance.delete();

    expect(deleted).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
    expect(instance.events).toEqual([]);
  });

  it("a_platform_failure_faults_it_with_the_ending_s_error_and_ends_it_once", () => {
    const instance = begun();
    const ending = aFaultedEnding();

    instance.fail(ending, later);
    instance.fail(ending, later);

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error).toEqual(ending.error);
    expect(instance.lifecycle).toEqual(ending.events);
    expect(instance.events.map((event) => event.kind)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });
});

describe("an awaited child", () => {
  it("is_awaited_by_its_parent_until_the_parent_stops_awaiting_its_effect", () => {
    const parent = begun([aCall("/do/0/child")]);
    const child = anInstanceIn(Phase.Running, {
      id: "child-1",
      trigger: TriggerKind.Parent,
      originId: parent.id,
      originEffectId: "/do/0/child",
    });

    expect(parent.awaitsChild(child)).toBe(true);
    expect(parent.abandons(child)).toBe(false);

    const turn = aTurn({ withdrawn: ["/do/0/child"] });
    parent.advance(turn, noSecrets, later);

    expect(parent.abandons(child)).toBe(true);
  });
});

describe("a run the platform's interpreter no longer continues", () => {
  function strandedBy(ending = aCancelledEnding()) {
    return { status: TurnStatus.Stranded, ending } as const;
  }

  it("is_cancelled_with_the_reason_that_the_interpreter_changed_and_ends_once", () => {
    const instance = begun();
    const ending = aCancelledEnding();
    const stranded = strandedBy(ending);

    instance.advance(stranded, noSecrets, later);
    instance.advance(stranded, noSecrets, later);

    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.cancelReason).toBe(CancelReason.InterpreterChanged);
    expect(instance.endedAt).toEqual(later);
    expect(instance.error).toBeNull();
    expect(instance.lifecycle).toEqual(ending.events);
    expect(instance.events.map((event) => event.kind)).toEqual([
      InstanceEventKind.Ended,
    ]);
  });

  it("awaits_nothing_once_cancelled", () => {
    const instance = begun();
    const stranded = strandedBy();

    instance.advance(stranded, noSecrets, later);

    expect(instance.agenda.awaited).toEqual([]);
    expect(instance.waits).toEqual([]);
    expect(instance.listening).toEqual([]);
  });

  it("leaves_a_pending_instance_to_begin_on_this_build", () => {
    const instance = anInstanceIn(Phase.Pending);
    const stranded = strandedBy();

    instance.advance(stranded, noSecrets, later);

    expect(instance.phase).toBe(Phase.Pending);
    expect(instance.cancelReason).toBeNull();
    expect(instance.events).toEqual([]);
  });

  it("leaves_an_ended_instance_as_it_ended", () => {
    const instance = begun();
    instance.advance(aTurn({ status: TurnStatus.Completed }), noSecrets, T0);
    instance.clearEvents();
    const stranded = strandedBy();

    instance.advance(stranded, noSecrets, later);

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.cancelReason).toBeNull();
    expect(instance.events).toEqual([]);
  });

  it("a_cancel_of_the_person_gives_no_reason", () => {
    const instance = begun();

    instance.advance(aTurn({ status: TurnStatus.Cancelled }), noSecrets, later);

    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.cancelReason).toBeNull();
  });
});

describe("a subscription a run receives on", () => {
  const orders = {
    execution: "/do/0/orders",
    request: { kind: "asyncapi" },
    closesAt: null,
  };

  function receiving() {
    const instance = anInstanceIn(Phase.Pending);
    const turn = aTurn({
      requested: [aTimer("/do/0/orders@message[0]")],
      receiving: [orders],
    });
    instance.begin(turn, noSecrets, T0);
    return instance;
  }

  it("stays_open_between_the_messages_it_receives", () => {
    const instance = receiving();
    const turn = aTurn({
      answered: ["/do/0/orders@message[0]"],
      requested: [aCall("/do/1/fetch")],
    });

    instance.advance(turn, noSecrets, later);

    expect(instance.receiving).toEqual([orders]);
  });

  it("closes_when_the_task_it_belongs_to_ends", () => {
    const instance = receiving();
    const turn = aTurn({
      answered: ["/do/0/orders@message[0]"],
      endedExecutions: ["/do/0/orders"],
    });

    instance.advance(turn, noSecrets, later);

    expect(instance.receiving).toEqual([]);
  });

  it("closes_when_the_instance_ends", () => {
    const instance = receiving();
    const turn = aTurn({ status: TurnStatus.Completed });

    instance.advance(turn, noSecrets, later);

    expect(instance.receiving).toEqual([]);
  });
});
