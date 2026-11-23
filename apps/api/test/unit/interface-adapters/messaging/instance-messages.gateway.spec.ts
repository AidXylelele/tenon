import type { TransactionHost } from "@nestjs-cls/transactional";
import type { NewOutboxMessage, Outbox } from "@nestjs/outbox";
import {
  EffectKind,
  InstanceEventKind,
  Phase,
  TaskValueKind,
  TriggerKind,
} from "../../../../src/domain/automation/instances/enums.js";
import { RunSecrets } from "../../../../src/domain/automation/secrets/run-secrets.js";
import { Workflow } from "../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../src/domain/automation/workflows/workflow-name.js";
import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { InstanceMessagesGateway } from "../../../../src/interface-adapters/messaging/instance-messages.gateway.js";
import type { Transaction } from "../../../../src/interface-adapters/persistence/interfaces.js";
import {
  aCall,
  aDefinition,
  aTimer,
  aTurn,
} from "../../../support/builders.js";
import { anInstanceIn, T0 } from "../../../support/fakes.js";

const TX = { id: "tx-1" };

class RecordingOutbox {
  readonly added: NewOutboxMessage[] = [];
  readonly transactions: unknown[] = [];

  add(
    tx: unknown,
    messages: NewOutboxMessage | NewOutboxMessage[],
  ): Promise<void> {
    this.transactions.push(tx);
    const many = ([] as NewOutboxMessage[]).concat(messages);

    for (const message of many) this.added.push(message);

    return Promise.resolve();
  }
}

function setUp() {
  const outbox = new RecordingOutbox();
  const txHost = { tx: TX } as unknown as TransactionHost<Transaction>;
  const gateway = new InstanceMessagesGateway(
    txHost,
    outbox as unknown as Outbox,
  );
  return { outbox, gateway };
}

const noSecrets = RunSecrets.of([]);

describe("the outbox messages of an instance's events", () => {
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

  it("an_end_keeps_its_topic_and_is_keyed_by_the_parent_that_awaits_it", async () => {
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
        topic: InstanceEventKind.Ended,
        key: "parent-1",
        payload: { instanceId: "child-1", parentId: "parent-1" },
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
  it("an_answer_carries_its_outcome_under_the_instance_key", async () => {
    const fixture = setUp();
    const instance = anInstanceIn(Phase.Running);
    const answer = { effectId: "/do/0/fetch", outcome: { kind: "responded" } };

    await fixture.gateway.respond(instance, answer);

    expect(fixture.outbox.added).toEqual([
      {
        topic: MessageTopic.RunRespond,
        key: "instance-1",
        payload: {
          instanceId: "instance-1",
          effectId: "/do/0/fetch",
          outcome: { kind: "responded" },
        },
      },
    ]);
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
});
