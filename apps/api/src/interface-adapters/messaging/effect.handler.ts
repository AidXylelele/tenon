import { Injectable, Logger } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { AnswerTimer } from "../../application/automation/instances/answer-timer.js";
import { EmitForEffect } from "../../application/automation/instances/emit-for-effect.js";
import { GiveUpEffect } from "../../application/automation/instances/give-up-effect.js";
import type {
  EffectCommand,
  EffectReference,
} from "../../application/automation/instances/interfaces.js";
import { PerformDetachedProcess } from "../../application/automation/instances/perform-detached-process.js";
import { PerformEffect } from "../../application/automation/instances/perform-effect.js";
import { StartChildForEffect } from "../../application/automation/instances/start-child-for-effect.js";
import { StartDetachedProcess } from "../../application/automation/instances/start-detached-process.js";
import { EffectKind } from "../../domain/automation/instances/enums.js";
import { PermanentFault } from "../workflows/permanent-fault.error.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import type {
  EffectMessage,
  ProcessMessage,
  TimerMessage,
} from "./interfaces.js";
import { RunDataMapper } from "./mappers/run-data.mapper.js";
import { RunHandler } from "./run.handler.js";

@Injectable()
export class EffectHandler {
  private readonly logger = new Logger(EffectHandler.name);

  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly runData: RunDataMapper,
    private readonly performEffect: PerformEffect,
    private readonly startDetachedProcess: StartDetachedProcess,
    private readonly performDetachedProcess: PerformDetachedProcess,
    private readonly startChildForEffect: StartChildForEffect,
    private readonly emitForEffect: EmitForEffect,
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
    return this.#reacted(context, message, () =>
      this.#routed(message.effect, command),
    );
  }

  @OnOutboxMessage(MessageTopic.RunTimer, { consumer: "timers" })
  elapsed(message: TimerMessage, context: OutboxHandlerContext): Promise<void> {
    return this.#reacted(context, message, () =>
      this.answerTimer.execute(message),
    );
  }

  @OnOutboxMessage(MessageTopic.RunProcess, { consumer: "processes" })
  async detached(
    message: ProcessMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const request = this.runData.dataOf(message.sealedRequest);
    const command = {
      instanceId: message.instanceId,
      effectId: message.effectId,
      versionId: message.versionId,
      request,
      signal: context.signal,
    };

    try {
      await this.span.around(context, () =>
        this.performDetachedProcess.execute(command),
      );
    } catch (error) {
      const permanent = error instanceof PermanentFault;
      const exhausted = context.attempt >= RunHandler.ATTEMPTS;

      if (!permanent && !exhausted) throw error;

      this.logger.warn(
        {
          err: error,
          instanceId: message.instanceId,
          effectId: message.effectId,
        },
        "A detached process failed and is given up; its run goes on",
      );
    }
  }

  #routed(effect: EffectKind, command: EffectCommand): Promise<void> {
    switch (effect) {
      case EffectKind.Call:
      case EffectKind.Process:
        return this.performEffect.execute(command);
      case EffectKind.Detached:
        return this.startDetachedProcess.execute(command);
      case EffectKind.Child:
        return this.startChildForEffect.execute(command);
      case EffectKind.Emit:
        return this.emitForEffect.execute(command);
      case EffectKind.Timer:
      case EffectKind.Listen:
      case EffectKind.Receive:
        return Promise.resolve();
    }
  }

  async #reacted(
    context: OutboxHandlerContext,
    reference: EffectReference,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.span.around(context, work);
    } catch (error) {
      const permanent = error instanceof PermanentFault;
      const exhausted = context.attempt >= RunHandler.ATTEMPTS;

      if (!permanent && !exhausted) throw error;

      await this.giveUpEffect.execute(reference);
    }

    this.outbox.notify();
  }
}
