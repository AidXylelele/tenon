import { Missing } from "../../../../src/application/automation/enums.js";
import { AnswerChildren } from "../../../../src/application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../../../src/application/automation/instances/answer-receives.js";
import { BeginRun } from "../../../../src/application/automation/instances/begin-run.js";
import { CancelInstance } from "../../../../src/application/automation/instances/cancel-instance.js";
import { CancelStrandedRun } from "../../../../src/application/automation/instances/cancel-stranded-run.js";
import type {
  AgendaResult,
  InputProblem,
  Receipt,
} from "../../../../src/application/automation/instances/interfaces.js";
import {
  ReceivedMessages,
  WorkflowRuntime,
} from "../../../../src/application/automation/instances/ports.js";
import { RespondToEffect } from "../../../../src/application/automation/instances/respond-to-effect.js";
import { ResumeInstance } from "../../../../src/application/automation/instances/resume-instance.js";
import { SuspendInstance } from "../../../../src/application/automation/instances/suspend-instance.js";
import { WakeParent } from "../../../../src/application/automation/instances/wake-parent.js";
import {
  CancelReason,
  InboundKind,
  Phase,
  TriggerKind,
  TurnStatus,
  WaitKind,
} from "../../../../src/domain/automation/instances/enums.js";
import type {
  AwaitedEffect,
  EffectAnswer,
  PlayedTurn,
  RunEnding,
  RunTurn,
} from "../../../../src/domain/automation/instances/interfaces.js";
import type { WorkflowInstance } from "../../../../src/domain/automation/instances/workflow-instance.js";
import {
  aCall,
  aCancelledEnding,
  aFaultedEnding,
  aTimer,
  aTurn,
} from "../../../support/builders.js";
import {
  anInstanceIn,
  RecordingInstanceRuns,
  StoredSecrets,
  StoredWorkflowInstanceRepository,
} from "../../../support/fakes.js";

class ScriptedRuntime extends WorkflowRuntime {
  readonly calls: string[] = [];

  constructor(
    private readonly turn: PlayedTurn,
    private readonly continued = true,
  ) {
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

  continues(): Promise<boolean> {
    this.calls.push("continues");
    return Promise.resolve(this.continued);
  }

  inputProblemsOf(): Promise<readonly InputProblem[]> {
    return Promise.resolve([]);
  }

  faultedEnding(): Promise<RunEnding> {
    this.calls.push("faultedEnding");
    return Promise.resolve(aFaultedEnding());
  }

  cancelledEnding(): Promise<RunEnding> {
    this.calls.push("cancelledEnding");
    return Promise.resolve(aCancelledEnding());
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
  request: { id, kind: "asyncapi", deadline: null },
  wait: {
    effectId: id,
    kind: WaitKind.Message,
    until: null,
    stream: null,
    retryOf: null,
    execution,
    position: 0,
  },
});

const aChild = (id: string): AwaitedEffect => ({
  id,
  request: { id, kind: "workflow", await: true, deadline: null },
  wait: {
    effectId: id,
    kind: WaitKind.Child,
    until: null,
    stream: null,
    retryOf: null,
    execution: null,
    position: null,
  },
});

const signal = new AbortController().signal;

function awaitedIn(result: AgendaResult): readonly string[] {
  if (!result.ok) throw new Error(result.failure);

  return result.value.awaited.map((effect) => effect.id);
}

function setUp(instance: WorkflowInstance, turn: PlayedTurn) {
  const instances = new StoredWorkflowInstanceRepository(instance);
  const runtime = new ScriptedRuntime(turn);
  const secrets = new StoredSecrets();
  const runs = new RecordingInstanceRuns(instances);
  return {
    instances,
    runtime,
    runs,
    begin: new BeginRun(instances, runtime, secrets),
    respond: new RespondToEffect(instances, runtime, secrets),
    suspend: new SuspendInstance(instances, runtime, secrets, runs),
    resume: new ResumeInstance(instances, runtime, secrets, runs),
    cancel: new CancelInstance(instances, runtime, secrets, runs),
    wakeParent: new WakeParent(instances, runs),
    answerChildren: new AnswerChildren(instances, runtime, secrets),
  };
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

describe("a run answered by effect id", () => {
  it("an_awaited_effect_is_answered_by_its_id_and_the_run_advances", async () => {
    const instance = await aBegunInstance();
    const turn = aTurn({ answered: ["/do/0/fetch"] });
    const fixture = setUp(instance, turn);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "emitted" } };

    const responded = await fixture.respond.execute({
      instanceId: instance.id,
      answer,
      signal,
    });

    expect(fixture.runtime.calls).toEqual(["respond /do/0/fetch"]);
    expect(awaitedIn(responded)).toEqual(["/do/1/pause"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Waiting);
  });

  it("an_answer_repeated_after_a_crash_never_reaches_the_interpreter", async () => {
    const instance = await aBegunInstance();
    const turn = aTurn({ answered: ["/do/0/fetch"] });
    const fixture = setUp(instance, turn);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "emitted" } };
    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    await fixture.respond.execute({ instanceId: instance.id, answer, signal });

    expect(fixture.runtime.calls).toEqual(["respond /do/0/fetch"]);
  });

  it("a_begin_repeated_after_a_crash_returns_the_agenda_it_began_with", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, aTurn());

    const begun = await fixture.begin.execute({
      instanceId: instance.id,
      signal,
    });

    expect(fixture.runtime.calls).toEqual([]);
    expect(awaitedIn(begun)).toEqual(["/do/0/fetch", "/do/1/pause"]);
  });

  it("a_run_of_an_instance_that_is_gone_is_refused_as_missing", async () => {
    const fixture = setUp(anInstanceIn(Phase.Pending), aTurn());

    const begun = await fixture.begin.execute({ instanceId: "gone", signal });

    expect(begun).toEqual({ ok: false, failure: Missing.Instance });
    expect(fixture.runtime.calls).toEqual([]);
  });
});

describe("suspension, resumption and cancellation", () => {
  it("a_suspension_is_the_interpreters_turn_and_wakes_the_run", async () => {
    const instance = await aBegunInstance();
    const suspended = aTurn({ status: TurnStatus.Suspended });
    const fixture = setUp(instance, suspended);

    const result = await fixture.suspend.execute({ instanceId: instance.id });

    expect(result.ok).toBe(true);
    expect(fixture.runtime.calls).toEqual(["suspend"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Suspended);
    expect(fixture.runs.woken).toEqual([instance.id]);
  });

  it("a_resumption_runs_the_instance_again", async () => {
    const instance = await aBegunInstance();
    const suspended = aTurn({ status: TurnStatus.Suspended });
    const suspending = setUp(instance, suspended);
    await suspending.suspend.execute({ instanceId: instance.id });
    const stored = await suspending.instances.find(instance.id);
    const fixture = setUp(stored ?? instance, aTurn());

    await fixture.resume.execute({ instanceId: instance.id });

    expect(fixture.runtime.calls).toEqual(["resume"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Running);
  });

  it("a_running_instance_is_cancelled_by_the_interpreters_turn", async () => {
    const instance = await aBegunInstance();
    const cancelled = aTurn({ status: TurnStatus.Cancelled });
    const fixture = setUp(instance, cancelled);

    await fixture.cancel.execute({ instanceId: instance.id, signal: null });

    expect(fixture.runtime.calls).toEqual(["cancel"]);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Cancelled);
    expect(fixture.runs.woken).toEqual([instance.id]);
  });

  it("a_pending_instance_is_cancelled_without_the_interpreter", async () => {
    const pending = anInstanceIn(Phase.Pending);
    const fixture = setUp(pending, aTurn());

    await fixture.cancel.execute({ instanceId: pending.id, signal: null });

    expect(fixture.runtime.calls).toEqual([]);
    expect(fixture.instances.phaseOf(pending.id)).toBe(Phase.Cancelled);
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

    const responded = await fixture.respond.execute({
      instanceId: instance.id,
      answer,
      signal,
    });
    const stored = await fixture.instances.find(instance.id);

    expect(awaitedIn(responded)).toEqual([]);
    expect(stored?.phase).toBe(Phase.Cancelled);
    expect(stored?.cancelReason).toBe(CancelReason.InterpreterChanged);
  });

  it("a_suspension_that_meets_it_cancels_it_and_wakes_the_run", async () => {
    const instance = await aBegunInstance();
    const fixture = setUp(instance, stranded);

    const result = await fixture.suspend.execute({ instanceId: instance.id });

    expect(result.ok).toBe(true);
    expect(fixture.instances.phaseOf(instance.id)).toBe(Phase.Cancelled);
    expect(fixture.runs.woken).toEqual([instance.id]);
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

  it("a_child_that_ends_before_its_parent_awaits_it_wakes_the_parent_and_is_answered_once_it_does", async () => {
    const parent = await aBegunInstance();
    const child = endedChildOf(parent);
    const awaiting = aTurn({ requested: [aChild(CHILD)] });
    const fixture = setUp(parent, awaiting);
    fixture.instances.put(child);

    await fixture.wakeParent.execute({ instanceId: child.id });
    await fixture.respond.execute({
      instanceId: parent.id,
      answer: { effectId: "/do/0/fetch", outcome: { kind: "responded" } },
      signal,
    });
    const answered = await fixture.answerChildren.execute({
      instanceId: parent.id,
      signal,
    });

    expect(fixture.runs.causes).toEqual([`child:${child.id}`]);
    expect(fixture.runs.woken).toEqual([parent.id]);
    expect(fixture.runtime.calls).toEqual([
      "respond /do/0/fetch",
      "answerChild",
    ]);
    expect(answered.ok).toBe(true);
  });

  it("a_parent_whose_awaited_children_have_not_ended_is_read_without_a_write", async () => {
    const parent = await aBegunInstance();
    const fixture = setUp(parent, aTurn());
    const saves = fixture.instances.saves;

    const read = await fixture.answerChildren.execute({
      instanceId: parent.id,
      signal,
    });

    expect(awaitedIn(read)).toEqual(["/do/0/fetch", "/do/1/pause"]);
    expect(fixture.runtime.calls).toEqual([]);
    expect(fixture.instances.saves).toBe(saves);
  });

  it("an_ended_parent_is_not_woken_by_its_child", async () => {
    const parent = anInstanceIn(Phase.Cancelled);
    const child = endedChildOf(parent);
    const fixture = setUp(parent, aTurn());
    fixture.instances.put(child);

    await fixture.wakeParent.execute({ instanceId: child.id });

    expect(fixture.runs.woken).toEqual([]);
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
    );

    await answer.execute({ instanceId: pending.id, signal });

    expect(fixture.runtime.calls).toEqual(["receive"]);
    expect(messages.forgotten).toEqual(["/fork/0/a@message[0]"]);
    expect(fixture.instances.phaseOf(pending.id)).toBe(Phase.Completed);
  });
});

describe("the cut-over to a new build of the interpreter", () => {
  it("cancels_a_live_run_this_build_cannot_continue_and_wakes_it", async () => {
    const instance = await aBegunInstance();
    const instances = new StoredWorkflowInstanceRepository(instance);
    const runtime = new ScriptedRuntime(aTurn(), false);
    const runs = new RecordingInstanceRuns(instances);
    const cutOver = new CancelStrandedRun(instances, runtime, runs);

    await cutOver.execute({ instanceId: instance.id });
    const stored = await instances.find(instance.id);

    expect(runtime.calls).toEqual(["continues", "cancelledEnding"]);
    expect(stored?.cancelReason).toBe(CancelReason.InterpreterChanged);
    expect(runs.woken).toEqual([instance.id]);
  });

  it("leaves_a_live_run_this_build_continues", async () => {
    const instance = await aBegunInstance();
    const instances = new StoredWorkflowInstanceRepository(instance);
    const runtime = new ScriptedRuntime(aTurn(), true);
    const runs = new RecordingInstanceRuns(instances);
    const cutOver = new CancelStrandedRun(instances, runtime, runs);

    await cutOver.execute({ instanceId: instance.id });
    const stored = await instances.find(instance.id);

    expect(stored?.phase).toBe(Phase.Running);
    expect(stored?.cancelReason).toBeNull();
    expect(runs.woken).toEqual([]);
  });
});
