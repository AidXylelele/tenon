import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { type Duration, type Lock, Locks } from "@nestjs/locks";
import { Interval } from "@nestjs/schedule";
import type { AsyncApiInboundMessage, Failure } from "interpreter";
import type { Receiver } from "../workflows/interfaces.js";
import { ReceiverController } from "../workflows/receiver.controller.js";
import {
  type AsyncApiInbox,
  type Consumer,
  SubscriptionClient,
} from "./interfaces.js";

@Injectable()
export class AsyncApiHandler implements OnModuleDestroy {
  private static readonly SYNC_MS = 2_000;
  private static readonly RETRY_MS = 30_000;
  private static readonly DEMAND_MS = 250;
  private static readonly LEASE: Duration = "30s";
  private static readonly RETRIED: readonly Failure["kind"][] = [
    "unreachable",
    "expired",
  ];

  private readonly logger = new Logger(AsyncApiHandler.name);
  readonly #consumers = new Map<string, Consumer>();
  #closing = false;

  constructor(
    private readonly receivers: ReceiverController,
    private readonly client: SubscriptionClient,
    private readonly locks: Locks,
  ) {}

  @Interval(AsyncApiHandler.SYNC_MS)
  async sync(): Promise<void> {
    if (this.#closing) return;

    const opened = await this.receivers.openReceivers();
    const keyed = opened.map(
      (receiver) => [this.#keyOf(receiver), receiver] as const,
    );
    const open = new Map(keyed);

    for (const [key, consumer] of this.#consumers) {
      const wanted = open.has(key);

      if (!wanted) consumer.stopped.abort();
    }

    if (this.#closing) return;

    for (const [key, receiver] of open) {
      const started = this.#consumers.has(key);

      if (!started) this.#start(key, receiver);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.#closing = true;
    const running = this.#consumers.values();
    const consumers = Array.from(running);

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
    const lease = { ttl: AsyncApiHandler.LEASE, signal: stopped };
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
    const secrets = await this.receivers.secretsOf(receiver.instanceId);
    const step = { idempotencyKey: key, signal: ended, secrets };
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
      step,
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

    for (;;) {
      const demanded = await this.receivers.demands(instanceId, execution);

      if (demanded) return;

      await setTimeout(AsyncApiHandler.DEMAND_MS, undefined, {
        signal: ended,
      });
    }
  }

  async #taken(
    receiver: Receiver,
    message: AsyncApiInboundMessage,
    fence: number,
    lost: AbortController,
  ): Promise<void> {
    const taken = await this.receivers
      .receive(receiver.instanceId, receiver.execution, message, fence)
      .catch((error: unknown) => {
        lost.abort();
        throw error;
      });

    if (taken) return;

    lost.abort();
    const refused = `The instance ${receiver.instanceId} no longer receives on ${receiver.execution}`;
    throw new Error(refused);
  }

  async #told(
    receiver: Receiver,
    failure: Failure,
    fence: number,
    answered: AbortController,
  ): Promise<void> {
    await this.receivers.failReceive(
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

    const retried = AsyncApiHandler.RETRIED.includes(failure.kind);

    if (!retried) {
      await this.receivers.failReceive(
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
    const retry = this.#retry();
    const wake = AbortSignal.any([held, retry]);
    await this.#until(wake);
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
    const retry = this.#retry();
    const wake = AbortSignal.any([stopped, retry]);
    await this.#until(wake);
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
    return AbortSignal.timeout(AsyncApiHandler.RETRY_MS);
  }

  #keyOf(receiver: Receiver): string {
    return `receiver:${receiver.instanceId}:${receiver.execution}`;
  }
}
