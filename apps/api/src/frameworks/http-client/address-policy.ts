import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { OnApplicationShutdown } from "@nestjs/common";
import { Agent, buildConnector } from "undici";

const REFUSED_NETWORKS: readonly string[] = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "::/96",
  "64:ff9b::/96",
  "64:ff9b:1::/48",
  "100::/64",
  "2001::/32",
  "2002::/16",
  "fc00::/7",
  "fe80::/10",
  "fec0::/10",
  "ff00::/8",
];

export class AddressPolicy implements OnApplicationShutdown {
  static readonly REFUSED = "ERR_ADDRESS_REFUSED";

  readonly dispatcher: Agent;
  private readonly refused = new BlockList();
  private readonly allowed = new BlockList();

  constructor(allowList: readonly string[]) {
    for (const network of REFUSED_NETWORKS) this.#add(this.refused, network);

    for (const entry of allowList) this.#add(this.allowed, entry);

    const checked: LookupFunction = (hostname, options, callback) => {
      this.#lookup(hostname, options, callback);
    };
    const connector = buildConnector({ lookup: checked });
    const connect: buildConnector.connector = (options, callback) => {
      this.#connect(connector, options, callback);
    };
    this.dispatcher = new Agent({ connect });
  }

  onApplicationShutdown(): Promise<void> {
    return this.dispatcher.close();
  }

  permits(address: string): boolean {
    const family = this.#familyOf(address);

    if (this.allowed.check(address, family)) return true;

    return !this.refused.check(address, family);
  }

  async admits(hostname: string): Promise<boolean> {
    const host = this.#unbracketed(hostname);

    if (isIP(host) !== 0) return this.permits(host);

    try {
      await this.resolve(host, 0);
      return true;
    } catch (error) {
      const code: unknown =
        error instanceof Error ? Reflect.get(error, "code") : undefined;
      return code !== AddressPolicy.REFUSED;
    }
  }

  async resolve(
    hostname: string,
    family: LookupOptions["family"],
  ): Promise<readonly LookupAddress[]> {
    const addresses = await lookup(hostname, { family, all: true });
    const refused = addresses.some(
      (resolved) => !this.permits(resolved.address),
    );

    if (refused) throw this.#refusal();

    return addresses;
  }

  #connect(
    connector: buildConnector.connector,
    options: buildConnector.Options,
    callback: buildConnector.Callback,
  ): void {
    const host = this.#unbracketed(options.hostname);
    const literal = isIP(host) !== 0;

    if (literal && !this.permits(host)) {
      callback(this.#refusal(), null);
      return;
    }

    connector(options, callback);
  }

  #lookup(
    hostname: string,
    options: LookupOptions,
    callback: Parameters<LookupFunction>[2],
  ): void {
    this.resolve(hostname, options.family).then(
      (addresses) => {
        if (options.all === true) {
          callback(null, addresses.slice());
          return;
        }

        const [first] = addresses;
        callback(null, first?.address ?? "", first?.family ?? 0);
      },
      (error: unknown) => {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        callback(failure, "", 0);
      },
    );
  }

  #unbracketed(hostname: string): string {
    return hostname.replace(/^\[(.*)\]$/, "$1");
  }

  #refusal(): Error {
    const error = new Error(
      "The address is private, loopback or link-local and not allow-listed",
    );
    return Object.assign(error, { code: AddressPolicy.REFUSED });
  }

  #add(list: BlockList, entry: string): void {
    const [network = "", prefix] = entry.split("/");
    const family = this.#familyOf(network);

    if (prefix === undefined) {
      list.addAddress(network, family);
      return;
    }

    const length = Number(prefix);
    list.addSubnet(network, length, family);
  }

  #familyOf(address: string): "ipv4" | "ipv6" {
    const version = isIP(address);

    if (version === 4) return "ipv4";

    if (version === 6) return "ipv6";

    throw new TypeError(`"${address}" is not an IP address`);
  }
}
