import type { TransactionHost } from "@nestjs-cls/transactional";
import type { WorkflowClient } from "@nestjs/workflows";
import {
  Control,
  Phase,
  TriggerKind,
} from "../../../../src/domain/automation/instances/enums.js";
import { EngineRunGateway } from "../../../../src/interface-adapters/workflows/gateways/engine-run.gateway.js";
import type { Transaction } from "../../../../src/interface-adapters/persistence/interfaces.js";
import { anInstanceIn } from "../../../support/fakes.js";

class EngineLog {
  readonly ids: string[] = [];
  readonly versions: (number | undefined)[] = [];

  start(
    _name: string,
    _input: unknown,
    options: { readonly version?: number },
  ): Promise<void> {
    this.versions.push(options.version);
    return Promise.resolve();
  }

  signal(
    _name: string,
    _payload: null,
    options: { readonly id: string },
  ): Promise<void> {
    this.ids.push(options.id);
    return Promise.resolve();
  }
}

describe("the starts and wakes of a run on the engine", () => {
  const log = new EngineLog();
  const txHost = { tx: {} } as unknown as TransactionHost<Transaction>;
  const gateway = new EngineRunGateway(
    log as unknown as WorkflowClient,
    txHost,
  );
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
    log.versions.length = 0;
  });

  it("a_run_starts_and_continues_at_the_version_of_the_run_workflow", async () => {
    await gateway.start(parent);
    await gateway.continueIn(parent.id, 2);

    expect(log.versions).toEqual([
      EngineRunGateway.VERSION,
      EngineRunGateway.VERSION,
    ]);
  });

  it("two_children_that_end_while_their_parent_keeps_one_state_wake_it_twice", async () => {
    const first = childOf("child-1", "/do/0/lines[0]/do/0/price");
    const second = childOf("child-2", "/do/0/lines[1]/do/0/price");

    await gateway.wakeOnChild(parent, first);
    await gateway.wakeOnChild(parent, second);

    expect(log.ids).toEqual([
      "parent-1:child:child-1",
      "parent-1:child:child-2",
    ]);
  });

  it("each_cause_wakes_with_an_id_of_its_own", async () => {
    const child = childOf("child-1", "/do/0/price");

    await gateway.wakeOnChild(parent, child);
    await gateway.wakeOnEvent(parent, 42);
    await gateway.wakeOnControl(parent, Control.Suspend);
    await gateway.wakeOnControl(parent, Control.Cancel);
    await gateway.wakeOnInbound(parent, "/do/0/orders", 3);

    const distinct = new Set(log.ids);
    expect(distinct.size).toBe(log.ids.length);
  });
});
