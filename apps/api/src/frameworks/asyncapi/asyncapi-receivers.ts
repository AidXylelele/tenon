import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Duration, type Lock, Locks } from "@nestjs/locks";
import { Interval } from "@nestjs/schedule";
import type { AsyncApiInboundMessage, Failure } from "interpreter";
import type { Receiver } from "../../interface-adapters/workflows/interfaces.js";
import { RunController } from "../../interface-adapters/workflows/run.controller.js";
import type { Env } from "../di/env.schema.js";
import { AsyncApiClient } from "./asyncapi.client.js";
import type { AsyncApiInbox, Consumer } from "./interfaces.js";
import { ReceiveRefused } from "./receive-refused.error.js";

@Injectable()
export class AsyncApiReceivers implements OnModuleDestroy {
  private static readonly SYNC_MS = 2_000;
  private static readonly RETRY_MS = 30_000;
  private static readonly DEMAND_MS = 250;
  private static readonly LEASE: Duration = "30s";
  private static readonly RETRIED: readonly Failure["kind"][] = [
    "unreachable",
    "expired",
  ];

  private readonly logger = new Logger(AsyncApiReceivers.name);
  private readonly enabled: boolean;
  readonly #consumers = new Map<string, Consumer>();
  #closing = false;

  constructor(
    private readonly runs: RunController,
    private readonly client: AsyncApiClient,
    private readonly locks: Locks,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get("ENGINE_WORKER", { infer: true }) === "on";
  }

  @Interval(AsyncApiReceivers.SYNC_MS)
  async tick(): Promise<void> {
    if (!this.enabled) return;

    await this.sync();
  }

  async sync(): Promise<void> {
    if (this.#closing) return;

    const receivers = await this.runs.openReceivers();
    const open = new Map(
      receivers.map((receiver) => [this.#keyOf(receiver), receiver]),
    );

    for (const [key, consumer] of this.#consumers)
      if (!open.has(key)) consumer.stopped.abort();

    if (this.#closing) return;

    for (const [key, receiver] of open)
      if (!this.#consumers.has(key)) this.#start(key, receiver);
  }

  async onModuleDestroy(): Promise<void> {
    this.#closing = true;
    const consumers = Array.from(this.#consumers.values());

    for (const consumer of consumers) consumer.stopped.abort();

    const done = consumers.map((consumer) => consumer.done);
    await Promise.allSettled(done);
  }

  #start(key: string, receiver: Receiver): void {
    const stopped = new AbortController();
    const done = this.#consumed(key, receiver, stopped.signal)
      .catch((error: unknown) => this.#failed(receiver, error, stopped.signal))
      .finally(() => {
        this.#consumers.delete(key);
      });
    this.#consumers.set(key, { stopped, done });
  }

  async #consumed(
    key: string,
    receiver: Receiver,
    stopped: AbortSignal,
  ): Promise<void> {
    const lease = { ttl: AsyncApiReceivers.LEASE, signal: stopped };
    const lock = await this.locks.acquire(key, lease);

    if (lock === null) return;

    try {
      await this.#received(key, receiver, lock, stopped);
    } finally {
      await lock.release();
    }
  }

  async #received(
    key: string,
    receiver: Receiver,
    lock: Lock,
    stopped: AbortSignal,
  ): Promise<void> {
    const held = AbortSignal.any([stopped, lock.signal]);
    const lost = new AbortController();
    const answered = new AbortController();
    const ended = AbortSignal.any([held, lost.signal, answered.signal]);
    const secrets = await this.runs.secretsOf(receiver.instanceId);
    const call = {
      idempotencyKey: key,
      signal: ended,
      secrets,
      remaining: null,
    };
    const fence = lock.fencingToken;
    let delivered = Promise.resolve();
    const inbox: AsyncApiInbox = {
      ended,
      demanded: () => this.#demanded(receiver, ended),
      message: (message) => {
        const taken = () => this.#taken(receiver, message, fence, lost);
        delivered = delivered.then(taken);
        return delivered;
      },
      failure: (failure) => {
        const told = () => this.#told(receiver, failure, fence, answered);
        delivered = delivered.then(told);
        return delivered;
      },
      lost: () => {
        lost.abort();
      },
    };
    const subscribed = await this.client.subscribe(
      receiver.request,
      call,
      inbox,
    );

    if (subscribed.kind !== "subscribed") {
      await this.#refused(receiver, subscribed, fence, held);
      return;
    }

    await this.#until(ended);
    const closed = subscribed.subscription.close();
    await Promise.allSettled([closed, delivered]);

    if (answered.signal.aborted) {
      await this.#until(held);
      return;
    }

    this.#lost(receiver, held);
  }

  async #demanded(receiver: Receiver, ended: AbortSignal): Promise<void> {
    const instanceId = receiver.instanceId;
    const execution = receiver.execution;

    while (!(await this.runs.demands(instanceId, execution)))
      await setTimeout(AsyncApiReceivers.DEMAND_MS, undefined, {
        signal: ended,
      });
  }

  async #taken(
    receiver: Receiver,
    message: AsyncApiInboundMessage,
    fence: number,
    lost: AbortController,
  ): Promise<void> {
    const taken = await this.runs
      .receive(receiver.instanceId, receiver.execution, message, fence)
      .catch((error: unknown) => {
        lost.abort();
        throw error;
      });

    if (taken) return;

    lost.abort();
    throw new ReceiveRefused(receiver.instanceId, receiver.execution);
  }

  async #told(
    receiver: Receiver,
    failure: Failure,
    fence: number,
    answered: AbortController,
  ): Promise<void> {
    await this.runs.failReceive(
      receiver.instanceId,
      receiver.execution,
      failure,
      fence,
    );
    answered.abort();
  }

  async #refused(
    receiver: Receiver,
    failure: Failure,
    fence: number,
    held: AbortSignal,
  ): Promise<void> {
    if (held.aborted) return;

    const retried = AsyncApiReceivers.RETRIED.includes(failure.kind);

    if (!retried) {
      await this.runs.failReceive(
        receiver.instanceId,
        receiver.execution,
        failure,
        fence,
      );
      await this.#until(held);
      return;
    }

    this.logger.warn(
      {
        failure,
        instanceId: receiver.instanceId,
        execution: receiver.execution,
      },
      "A receiver could not reach its broker and tries again later",
    );
    await this.#until(AbortSignal.any([held, this.#retry()]));
  }

  async #failed(
    receiver: Receiver,
    error: unknown,
    stopped: AbortSignal,
  ): Promise<void> {
    if (stopped.aborted) return;

    this.logger.warn(
      {
        err: error,
        instanceId: receiver.instanceId,
        execution: receiver.execution,
      },
      "A receiver failed and subscribes again later",
    );
    await this.#until(AbortSignal.any([stopped, this.#retry()]));
  }

  #lost(receiver: Receiver, held: AbortSignal): void {
    if (held.aborted) return;

    this.logger.warn(
      {
        instanceId: receiver.instanceId,
        execution: receiver.execution,
      },
      "A receiver lost its broker connection and subscribes again",
    );
  }

  async #until(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;

    await once(signal, "abort");
  }

  #retry(): AbortSignal {
    return AbortSignal.timeout(AsyncApiReceivers.RETRY_MS);
  }

  #keyOf(receiver: Receiver): string {
    return `receiver:${receiver.instanceId}:${receiver.execution}`;
  }
}
