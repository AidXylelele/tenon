import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { AnswerTimer } from "../../application/automation/instances/answer-timer.js";
import { EmitForEffect } from "../../application/automation/instances/emit-for-effect.js";
import { FindEffectKind } from "../../application/automation/instances/find-effect-kind.js";
import { GiveUpEffect } from "../../application/automation/instances/give-up-effect.js";
import type { EffectCommand } from "../../application/automation/instances/interfaces.js";
import { PerformEffect } from "../../application/automation/instances/perform-effect.js";
import { ReceiveForEffect } from "../../application/automation/instances/receive-for-effect.js";
import { StartChildForEffect } from "../../application/automation/instances/start-child-for-effect.js";
import { StartDetachedProcess } from "../../application/automation/instances/start-detached-process.js";
import { EffectKind } from "../../domain/automation/instances/enums.js";
import { PermanentFault } from "../workflows/permanent-fault.error.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import type { EffectMessage, TimerMessage } from "./interfaces.js";
import { RunHandler } from "./run.handler.js";

@Injectable()
export class EffectHandler {
  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly findEffectKind: FindEffectKind,
    private readonly performEffect: PerformEffect,
    private readonly startDetachedProcess: StartDetachedProcess,
    private readonly startChildForEffect: StartChildForEffect,
    private readonly emitForEffect: EmitForEffect,
    private readonly receiveForEffect: ReceiveForEffect,
    private readonly answerTimer: AnswerTimer,
    private readonly giveUpEffect: GiveUpEffect,
  ) {}

  @OnOutboxMessage(MessageTopic.RunEffect, { consumer: "effects" })
  requested(
    message: EffectMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      instanceId: message.instanceId,
      effectId: message.effectId,
      signal: context.signal,
    };
    return this.#reacted(context, message, () => this.#routed(command));
  }

  @OnOutboxMessage(MessageTopic.RunTimer, { consumer: "timers" })
  elapsed(message: TimerMessage, context: OutboxHandlerContext): Promise<void> {
    return this.#reacted(context, message, () =>
      this.answerTimer.execute(message),
    );
  }

  async #routed(command: EffectCommand): Promise<void> {
    const kind = await this.findEffectKind.execute(command);

    switch (kind) {
      case EffectKind.Call:
      case EffectKind.Process:
        return this.performEffect.execute(command);
      case EffectKind.Detached:
        return this.startDetachedProcess.execute(command);
      case EffectKind.Child:
        return this.startChildForEffect.execute(command);
      case EffectKind.Emit:
        return this.emitForEffect.execute(command);
      case EffectKind.Receive:
        return this.receiveForEffect.execute(command);
      case EffectKind.Timer:
      case EffectKind.Listen:
      case null:
        return;
    }
  }

  async #reacted(
    context: OutboxHandlerContext,
    message: EffectMessage,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.span.around(context, work);
    } catch (error) {
      const permanent = error instanceof PermanentFault;
      const exhausted = context.attempt >= RunHandler.ATTEMPTS;

      if (!permanent && !exhausted) throw error;

      const reference = {
        instanceId: message.instanceId,
        effectId: message.effectId,
      };
      await this.giveUpEffect.execute(reference);
    }

    this.outbox.notify();
  }
}
