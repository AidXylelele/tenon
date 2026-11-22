import { createHash } from "node:crypto";
import type { AddressPolicy } from "../http-client/address-policy.js";
import type { BrokerCredentials, BrokerServer, Lost } from "./interfaces.js";

export class BrokerConnections<T> {
  readonly #opened = new Map<string, Promise<T>>();

  constructor(
    private readonly addresses: AddressPolicy,
    private readonly closing: (connection: T) => Promise<void>,
  ) {}

  of(
    server: BrokerServer,
    credentials: BrokerCredentials,
    open: (address: string, lost: Lost) => Promise<T>,
  ): Promise<T> {
    const key = this.#keyOf(server, credentials);
    const kept = this.#opened.get(key);

    if (kept !== undefined) return kept;

    const lost = () => {
      this.#forget(key, opening);
    };
    const opening = this.#opening(server, (address) => open(address, lost));
    this.#opened.set(key, opening);
    void opening.catch(lost);
    return opening;
  }

  dedicated<Dedicated>(
    server: BrokerServer,
    open: (address: string) => Promise<Dedicated>,
  ): Promise<Dedicated> {
    return this.#opening(server, open);
  }

  async close(): Promise<void> {
    const opened = Array.from(this.#opened.values());
    this.#opened.clear();
    const closed = opened.map((opening) => this.#closed(opening));
    await Promise.allSettled(closed);
  }

  async #opening<Opened>(
    server: BrokerServer,
    open: (address: string) => Promise<Opened>,
  ): Promise<Opened> {
    const [resolved] = await this.addresses.resolve(server.hostname, 0);

    if (resolved === undefined)
      throw new Error("The host name could not be resolved");

    return open(resolved.address);
  }

  async #closed(opening: Promise<T>): Promise<void> {
    const connection = await opening;
    await this.closing(connection);
  }

  #forget(key: string, opening: Promise<T>): void {
    if (this.#opened.get(key) === opening) this.#opened.delete(key);
  }

  #keyOf(server: BrokerServer, credentials: BrokerCredentials): string {
    const identity = JSON.stringify([server.url, credentials]);
    return createHash("sha256").update(identity).digest("hex");
  }
}
