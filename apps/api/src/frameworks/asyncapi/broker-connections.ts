import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import type { AddressPolicy } from "../http/address-policy.js";
import type { BrokerServer, Login, Lost, Opening } from "./interfaces.js";

export class BrokerConnections<C extends object> {
  static readonly CONNECT_MS = 5_000;
  private static readonly OPEN_MS = 10_000;
  private static readonly KEPT = 64;
  private static readonly IDLE_MS = 5 * 60 * 1000;

  private readonly opened: LRUCache<string, C, Opening<C>>;
  private readonly closings = new Set<Promise<unknown>>();

  constructor(
    private readonly addresses: AddressPolicy,
    private readonly closing: (connection: C) => Promise<void> | void,
  ) {
    this.opened = new LRUCache<string, C, Opening<C>>({
      max: BrokerConnections.KEPT,
      ttl: BrokerConnections.IDLE_MS,
      ttlAutopurge: true,
      updateAgeOnGet: true,
      fetchMethod: (key, _stale, { signal, context }) =>
        this.#fetched(key, signal, context),
      dispose: (connection) => {
        this.#closed(connection);
      },
    });
  }

  of(
    server: BrokerServer,
    variant: string,
    login: Login | null,
    open: (address: string, lost: Lost) => Promise<C>,
  ): Promise<C> {
    const key = this.#keyOf(server, variant, login);
    const context = { server, open };
    const signal = AbortSignal.timeout(BrokerConnections.OPEN_MS);
    return this.opened.forceFetch(key, { context, signal });
  }

  dedicated<Dedicated>(
    server: BrokerServer,
    open: (address: string) => Promise<Dedicated>,
  ): Promise<Dedicated> {
    return this.#dialled(server, open);
  }

  async close(): Promise<void> {
    this.opened.clear();
    const closing = Array.from(this.closings);
    await Promise.all(closing);
  }

  async #fetched(
    key: string,
    signal: AbortSignal,
    opening: Opening<C>,
  ): Promise<C> {
    const ended = new AbortController();
    const lost = () => {
      ended.abort();
    };
    const connection = await this.#dialled(opening.server, (address) =>
      opening.open(address, lost),
    );
    const dropped = signal.aborted || ended.signal.aborted;

    if (dropped) {
      this.#closed(connection);
      throw new Error("The broker connection ended as it opened");
    }

    const forget = () => {
      this.#forgotten(key, connection);
    };
    ended.signal.addEventListener("abort", forget, { once: true });
    return connection;
  }

  async #dialled<Opened>(
    server: BrokerServer,
    open: (address: string) => Promise<Opened>,
  ): Promise<Opened> {
    const [resolved] = await this.addresses.resolve(server.hostname, 0);

    if (resolved === undefined)
      throw new Error("The host name could not be resolved");

    return open(resolved.address);
  }

  #forgotten(key: string, connection: C): void {
    const kept = this.opened.peek(key);

    if (kept === connection) this.opened.delete(key);
  }

  #closed(connection: C): void {
    const closing = this.closing(connection);
    const settled = Promise.allSettled([closing]);
    this.closings.add(settled);
    void settled.then(() => this.closings.delete(settled));
  }

  #keyOf(server: BrokerServer, variant: string, login: Login | null): string {
    const identity = JSON.stringify([
      server.url,
      server.secure,
      variant,
      login,
    ]);
    return createHash("sha256").update(identity).digest("hex");
  }
}
