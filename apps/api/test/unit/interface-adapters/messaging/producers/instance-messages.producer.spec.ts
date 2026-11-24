import type { TransactionHost } from "@nestjs-cls/transactional";
import type { Outbox } from "@nestjs/outbox";
import {
  EffectKind,
  Phase,
  TaskValueKind,
  TriggerKind,
  TurnStatus,
} from "../../../../../src/domain/automation/instances/enums.js";
import { RunSecrets } from "../../../../../src/domain/automation/secrets/run-secrets.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { MessageTopic } from "../../../../../src/interface-adapters/messaging/enums.js";
import { InstanceMessagesProducer } from "../../../../../src/interface-adapters/messaging/producers/instance-messages.producer.js";
import type {
  ProcessMessage,
  RespondMessage,
} from "../../../../../src/interface-adapters/messaging/interfaces.js";
import type { Transaction } from "../../../../../src/interface-adapters/persistence/interfaces.js";
import {
  aCall,
  aDefinition,
  aTimer,
  aTurn,
} from "../../../../support/builders.js";
import { anInstanceIn, T0 } from "../../../../support/fakes.js";
import { RecordingOutbox, runDataMapper } from "../../../../support/outbox.js";

const TX = { id: "tx-1" };
const runData = runDataMapper;

function setUp() {
  const outbox = new RecordingOutbox();
  const txHost = { tx: TX } as unknown as TransactionHost<Transaction>;
  const gateway = new InstanceMessagesProducer(
    txHost,
    outbox as unknown as Outbox,
    runData,
  );
  return { outbox, gateway };
}

const noSecrets = RunSecrets.of([]);

describe("the outbox messages of an instance's events", () => {
  it("a_requested_receive_asks_the_run_to_take_its_stored_messages", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Pending);
    const receive = {
      id: "/do/0/orders@message[0]",
      kind: EffectKind.Receive,
      request: {},
      wait: null,
    };
    const turn = aTurn({ requested: [receive] });
    instance.begin(turn, noSecrets, T0);

    await fixture.gateway.dispatch(instance);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.RunReceives,
        key: "instance-1",
        payload: { instanceId: "instance-1" },
      },
    ]);
  });

  it("a_requested_effect_flows_under_its_own_key_and_a_timer_waits_for_its_instant", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Pending);
    const output = {
      execution: "/do/0/fetch",
      kind: TaskValueKind.Output,
      value: 1,
    };
    const turn = aTurn({
      requested: [aCall("/do/0/fetch"), aTimer("/do/1/pause", 30_000)],
      taskValues: [output],
    });
    instance.begin(turn, noSecrets, T0);

    await fixture.gateway.dispatch(instance);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.RunEffect,
        key: "instance-1//do/0/fetch",
        payload: {
          instanceId: "instance-1",
          effectId: "/do/0/fetch",
          effect: EffectKind.Call,
        },
      },
      {
        topic: MessageTopic.RunTimer,
        key: "instance-1//do/1/pause/30000",
        payload: {
          instanceId: "instance-1",
          effectId: "/do/1/pause",
          at: 30_000,
        },
        availableAt: 30_000,
      },
    ]);
    expect(fixture.outbox.transactions).toEqual([TX]);
    expect(instance.events).toEqual([]);
    expect(instance.taskValues).toHaveLength(1);
  });

  it("a_start_begins_the_run_under_the_instance_key", async () => {
    const fixture = setUp();
    const workflow = Workflow.register(new WorkflowName("sales", "route-lead"));
    const definition = aDefinition();
    workflow.publish({ definition, source: null, publisherId: "a-1", now: T0 });
    const version = workflow.versionToRun(null);

    if (version === null) throw new Error("the workflow was not published");

    const started = workflow.startInstance({
      instanceId: "child-1",
      version,
      input: {},
      trigger: TriggerKind.Manual,
      starterId: "author-1",
      origin: null,
      originEffectId: null,
      now: T0,
    });

    if (!started.ok) throw new Error(started.failure);

    const instance = started.value;

    await fixture.gateway.dispatch(instance);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.RunBegin,
        key: "child-1",
        payload: { instanceId: "child-1" },
      },
    ]);
  });

  it("an_awaited_childs_end_is_keyed_by_its_parent", async () => {
    const fixture = setUp();
    const child = anInstanceIn(Phase.Running, {
      id: "child-1",
      trigger: TriggerKind.Parent,
      originId: "parent-1",
      originEffectId: "/do/0/child",
    });
    child.cancel(T0);

    await fixture.gateway.dispatch(child);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.ChildEnded,
        key: "parent-1",
        payload: { instanceId: "child-1", parentId: "parent-1" },
      },
    ]);
  });

  it("a_completed_scheduled_run_is_keyed_by_its_workflow", async () => {
    const fixture = setUp();
    const scheduled = anInstanceIn(Phase.Pending, {
      trigger: TriggerKind.Schedule,
    });
    const completed = aTurn({ status: TurnStatus.Completed });
    scheduled.begin(completed, noSecrets, T0);

    await fixture.gateway.dispatch(scheduled);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.ScheduledCompleted,
        key: "workflow-1",
        payload: { instanceId: "instance-1" },
      },
    ]);
  });

  it("abandoned_children_are_a_command_under_the_instance_key", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Pending);
    const begun = aTurn({ requested: [aCall("/do/0/child")] });
    const abandoning = aTurn({
      withdrawn: ["/do/0/child"],
      abandoned: ["/do/0/child"],
    });
    instance.begin(begun, noSecrets, T0);
    instance.clearEvents();
    instance.advance(abandoning, noSecrets, T0);

    await fixture.gateway.dispatch(instance);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.ChildrenAbandoned,
        key: "instance-1",
        payload: { instanceId: "instance-1" },
      },
    ]);
  });

  it("nothing_raised_adds_nothing", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Running);

    await fixture.gateway.dispatch(instance);

    expect(fixture.outbox.added).toEqual([]);
  });
});

describe("the run commands of an instance", () => {
  it("an_answer_carries_its_outcome_sealed_under_the_instance_key", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Running);
    const outcome = { kind: "responded", body: "card 4111" };
    const answer = { effectId: "/do/0/fetch", outcome };

    await fixture.gateway.respond(instance, answer);

    const sent = fixture.outbox.added[0];
    const payload = sent?.payload as RespondMessage;
    const text = JSON.stringify(sent);
    const opened = runData.dataOf(payload.sealedOutcome);
    expect(sent?.topic).toBe(MessageTopic.RunRespond);
    expect(sent?.key).toBe("instance-1");
    expect(payload.instanceId).toBe("instance-1");
    expect(payload.effectId).toBe("/do/0/fetch");
    expect(text).not.toContain("card 4111");
    expect(opened).toEqual(outcome);
  });

  it("a_detached_process_carries_its_request_sealed_under_its_effect_key", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Running);
    const request = { kind: "process", script: "echo card 4111" };

    await fixture.gateway.detach(instance, "/do/0/report", request);

    const sent = fixture.outbox.added[0];
    const payload = sent?.payload as ProcessMessage;
    const text = JSON.stringify(sent);
    const opened = runData.dataOf(payload.sealedRequest);
    expect(sent?.topic).toBe(MessageTopic.RunProcess);
    expect(sent?.key).toBe("instance-1//do/0/report");
    expect(payload.instanceId).toBe("instance-1");
    expect(payload.effectId).toBe("/do/0/report");
    expect(payload.versionId).toBe("version-1");
    expect(text).not.toContain("card 4111");
    expect(opened).toEqual(request);
  });

  it("receives_and_failures_are_commands_under_the_instance_key", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Running);

    await fixture.gateway.receive(instance);
    await fixture.gateway.fail(instance);

    const sent = fixture.outbox.added.map((message) => [
      message.topic,
      message.key,
    ]);
    expect(sent).toEqual([
      [MessageTopic.RunReceives, "instance-1"],
      [MessageTopic.RunFail, "instance-1"],
    ]);
  });

  it("each_abandoned_child_is_asked_to_cancel_under_its_own_key", async () => {
    const fixture = setUp();
    const first = anInstanceIn(Phase.Running, { id: "child-1" });
    const second = anInstanceIn(Phase.Running, { id: "child-2" });

    await fixture.gateway.request([first, second]);
    await fixture.gateway.request([]);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.CancelRequested,
        key: "child-1",
        payload: { instanceId: "child-1" },
      },
      {
        topic: MessageTopic.CancelRequested,
        key: "child-2",
        payload: { instanceId: "child-2" },
      },
    ]);
  });
});
