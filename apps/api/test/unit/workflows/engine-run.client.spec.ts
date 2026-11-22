import type { TransactionHost } from "@nestjs-cls/transactional";
import type { WorkflowClient } from "@nestjs/workflows";
import {
  Control,
  Phase,
  TriggerKind,
} from "../../../src/domain/automation/instances/enums.js";
import { EngineRunClient } from "../../../src/frameworks/workflows/engine-run.client.js";
import type { Transaction } from "../../../src/interface-adapters/persistence/interfaces.js";
import { anInstanceIn } from "../../support/fakes.js";

class SignalLog {
  readonly ids: string[] = [];

  signal(
    _name: string,
    _payload: null,
    options: { readonly id: string },
  ): Promise<void> {
    this.ids.push(options.id);
    return Promise.resolve();
  }
}

describe("the wakes of a run on the engine", () => {
  const log = new SignalLog();
  const txHost = { tx: {} } as unknown as TransactionHost<Transaction>;
  const client = new EngineRunClient(log as unknown as WorkflowClient, txHost);
  const parent = anInstanceIn(Phase.Waiting, { id: "parent-1" });

  function childOf(id: string, effectId: string) {
    return anInstanceIn(Phase.Completed, {
      id,
      trigger: TriggerKind.Parent,
      originId: parent.id,
      originEffectId: effectId,
    });
  }

  beforeEach(() => {
    log.ids.length = 0;
  });

  it("two_children_that_end_while_their_parent_keeps_one_state_wake_it_twice", async () => {
    const first = childOf("child-1", "/do/0/lines[0]/do/0/price");
    const second = childOf("child-2", "/do/0/lines[1]/do/0/price");

    await client.wakeOnChild(parent, first);
    await client.wakeOnChild(parent, second);

    expect(log.ids).toEqual([
      "parent-1:child:child-1",
      "parent-1:child:child-2",
    ]);
  });

  it("each_cause_wakes_with_an_id_of_its_own", async () => {
    const child = childOf("child-1", "/do/0/price");

    await client.wakeOnChild(parent, child);
    await client.wakeOnEvent(parent, 42);
    await client.wakeOnControl(parent, Control.Suspend);
    await client.wakeOnControl(parent, Control.Cancel);
    await client.wakeOnCutOver(parent);
    await client.wakeOnInbound(parent, "/do/0/orders", 3);

    const distinct = new Set(log.ids);
    expect(distinct.size).toBe(log.ids.length);
  });
});
