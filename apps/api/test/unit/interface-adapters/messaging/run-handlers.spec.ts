import type { Outbox } from "@nestjs/outbox";
import type { AnswerChildren } from "../../../../src/application/automation/instances/answer-children.js";
import type { AnswerReceives } from "../../../../src/application/automation/instances/answer-receives.js";
import type { AnswerTimer } from "../../../../src/application/automation/instances/answer-timer.js";
import type { BeginRun } from "../../../../src/application/automation/instances/begin-run.js";
import type { EmitForEffect } from "../../../../src/application/automation/instances/emit-for-effect.js";
import type { FailRun } from "../../../../src/application/automation/instances/fail-run.js";
import type { GiveUpEffect } from "../../../../src/application/automation/instances/give-up-effect.js";
import type { PerformDetachedProcess } from "../../../../src/application/automation/instances/perform-detached-process.js";
import type { PerformEffect } from "../../../../src/application/automation/instances/perform-effect.js";
import type { RespondToEffect } from "../../../../src/application/automation/instances/respond-to-effect.js";
import type { StartChildForEffect } from "../../../../src/application/automation/instances/start-child-for-effect.js";
import type { StartDetachedProcess } from "../../../../src/application/automation/instances/start-detached-process.js";
import { EffectKind } from "../../../../src/domain/automation/instances/enums.js";
import { ConsumerSpan } from "../../../../src/interface-adapters/messaging/consumer-span.js";
import { MessageTopic } from "../../../../src/interface-adapters/messaging/enums.js";
import { EffectHandler } from "../../../../src/interface-adapters/messaging/effect.handler.js";
import { RunHandler } from "../../../../src/interface-adapters/messaging/run.handler.js";
import { PermanentFault } from "../../../../src/interface-adapters/workflows/permanent-fault.error.js";
import { aHandlerContext, runDataMapper } from "../../../support/outbox.js";

const runData = runDataMapper;
const contextAt = (attempt: number) =>
  aHandlerContext(MessageTopic.RunBegin, "runs", attempt);

class Recorder {
  readonly calls: string[] = [];
  notified = 0;
  failure: Error | null = null;

  use<T>(name: string): T {
    const execute = (command: unknown) => {
      this.calls.push(`${name} ${JSON.stringify(command)}`);

      if (this.failure !== null && name !== "fail" && name !== "giveUp")
        return Promise.reject(this.failure);

      return Promise.resolve();
    };
    return { execute } as unknown as T;
  }

  outbox(): Outbox {
    const outbox = {
      notify: () => {
        this.notified += 1;
      },
    };
    return outbox as unknown as Outbox;
  }
}

function runHandlerOf(recorder: Recorder): RunHandler {
  return new RunHandler(
    new ConsumerSpan(),
    recorder.outbox(),
    runData,
    recorder.use<BeginRun>("begin"),
    recorder.use<RespondToEffect>("respond"),
    recorder.use<AnswerChildren>("children"),
    recorder.use<AnswerReceives>("receives"),
    recorder.use<FailRun>("fail"),
  );
}

function effectHandlerOf(recorder: Recorder) {
  return new EffectHandler(
    new ConsumerSpan(),
    recorder.outbox(),
    runData,
    recorder.use<PerformEffect>("perform"),
    recorder.use<StartDetachedProcess>("detach"),
    recorder.use<PerformDetachedProcess>("process"),
    recorder.use<StartChildForEffect>("child"),
    recorder.use<EmitForEffect>("emit"),
    recorder.use<AnswerTimer>("timer"),
    recorder.use<GiveUpEffect>("giveUp"),
  );
}

const names = (recorder: Recorder) =>
  recorder.calls.map((call) => call.split(" ")[0]);

describe("the run commands an instance's key orders", () => {
  it("a_begin_plays_the_first_turn_and_wakes_the_relay", async () => {
    const recorder = new Recorder();
    const handler = runHandlerOf(recorder);
    const context = contextAt(1);

    await handler.begun({ instanceId: "instance-1" }, context);

    expect(names(recorder)).toEqual(["begin"]);
    expect(recorder.notified).toBe(1);
  });

  it("an_answer_reaches_the_run_with_its_outcome_unsealed", async () => {
    const recorder = new Recorder();
    const handler = runHandlerOf(recorder);
    const outcome = { kind: "responded" };
    const sealedOutcome = runData.sealedOf(outcome);
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/fetch",
      sealedOutcome,
    };
    const context = contextAt(1);

    await handler.responded(message, context);

    expect(recorder.calls[0]).toContain(
      '"answer":{"effectId":"/do/0/fetch","outcome":{"kind":"responded"}}',
    );
  });

  it("a_child_end_answers_its_parent_and_an_unawaited_one_nothing", async () => {
    const recorder = new Recorder();
    const handler = runHandlerOf(recorder);
    const context = contextAt(1);

    await handler.childEnded(
      { instanceId: "child-1", parentId: "parent-1" },
      context,
    );
    await handler.childEnded(
      { instanceId: "child-2", parentId: null },
      context,
    );

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toContain('"instanceId":"parent-1"');
  });

  it("a_transient_failure_is_retried", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The database is busy");
    const handler = runHandlerOf(recorder);
    const context = contextAt(9);

    const played = handler.begun({ instanceId: "instance-1" }, context);

    await expect(played).rejects.toThrow("The database is busy");
    expect(names(recorder)).toEqual(["begin"]);
  });

  it("a_permanent_fault_fails_the_run_instead_of_dead_lettering", async () => {
    const recorder = new Recorder();
    recorder.failure = new PermanentFault("The interpreter ran out of memory");
    const handler = runHandlerOf(recorder);
    const context = contextAt(1);

    await handler.begun({ instanceId: "instance-1" }, context);

    expect(names(recorder)).toEqual(["begin", "fail"]);
  });

  it("the_last_attempt_fails_the_run", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The database is busy");
    const handler = runHandlerOf(recorder);
    const context = contextAt(RunHandler.ATTEMPTS);

    await handler.received({ instanceId: "instance-1" }, context);

    expect(names(recorder)).toEqual(["receives", "fail"]);
  });
});

describe("the effects a run asks for", () => {
  const routes: readonly [EffectKind, string][] = [
    [EffectKind.Call, "perform"],
    [EffectKind.Process, "perform"],
    [EffectKind.Detached, "detach"],
    [EffectKind.Child, "child"],
    [EffectKind.Emit, "emit"],
  ];

  it.each(routes)(
    "a_%s_effect_is_handled_by_its_%s_use_case",
    async (kind, name) => {
      const recorder = new Recorder();
      const handler = effectHandlerOf(recorder);
      const message = {
        instanceId: "instance-1",
        effectId: "/do/0/x",
        effect: kind,
      };
      const context = contextAt(1);

      await handler.requested(message, context);

      expect(names(recorder)).toEqual([name]);
      expect(recorder.notified).toBe(1);
    },
  );

  it("a_wait_asks_nothing_of_the_world", async () => {
    const recorder = new Recorder();
    const handler = effectHandlerOf(recorder);
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/x",
      effect: EffectKind.Listen,
    };
    const context = contextAt(1);

    await handler.requested(message, context);

    expect(recorder.calls).toEqual([]);
  });

  it("the_last_attempt_gives_the_effect_up", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The sandbox is unreachable");
    const handler = effectHandlerOf(recorder);
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/x",
      effect: EffectKind.Call,
    };
    const context = contextAt(RunHandler.ATTEMPTS);

    await handler.requested(message, context);

    expect(names(recorder)).toEqual(["perform", "giveUp"]);
  });

  it("a_detached_process_is_performed_with_its_request_unsealed", async () => {
    const recorder = new Recorder();
    const handler = effectHandlerOf(recorder);
    const sealedRequest = runData.sealedOf({ id: "/do/0/report" });
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/report",
      versionId: "version-1",
      sealedRequest,
    };
    const context = contextAt(1);

    await handler.detached(message, context);

    expect(names(recorder)).toEqual(["process"]);
    expect(recorder.calls[0]).toContain('"request":{"id":"/do/0/report"}');
  });

  it("a_failing_detached_process_is_retried", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The sandbox is unreachable");
    const handler = effectHandlerOf(recorder);
    const sealedRequest = runData.sealedOf({ id: "/do/0/report" });
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/report",
      versionId: "version-1",
      sealedRequest,
    };
    const context = contextAt(1);

    const performed = handler.detached(message, context);

    await expect(performed).rejects.toThrow("The sandbox is unreachable");
  });

  it("an_exhausted_detached_process_is_given_up_without_touching_its_run", async () => {
    const recorder = new Recorder();
    recorder.failure = new Error("The sandbox is unreachable");
    const handler = effectHandlerOf(recorder);
    const sealedRequest = runData.sealedOf({ id: "/do/0/report" });
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/report",
      versionId: "version-1",
      sealedRequest,
    };
    const context = contextAt(RunHandler.ATTEMPTS);

    await handler.detached(message, context);

    expect(names(recorder)).toEqual(["process"]);
  });

  it("a_timer_answers_its_wait", async () => {
    const recorder = new Recorder();
    const handler = effectHandlerOf(recorder);
    const message = {
      instanceId: "instance-1",
      effectId: "/do/0/pause",
      at: 30_000,
    };
    const context = contextAt(1);

    await handler.elapsed(message, context);

    expect(names(recorder)).toEqual(["timer"]);
  });
});
