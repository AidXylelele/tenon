import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import type { OnApplicationShutdown } from "@nestjs/common";
import ipaddr from "ipaddr.js";
import { Agent, buildConnector } from "undici";
import type { AddressRange, AddressRanges, IpAddress } from "./interfaces.js";

export class AddressPolicy implements OnApplicationShutdown {
  static readonly REFUSED = "ERR_ADDRESS_REFUSED";
  private static readonly IPV4_COMPATIBLE = "::/96";
  private static readonly UNLISTED = "unlisted";
  private static readonly HOST_BITS = { ipv4: 32, ipv6: 128 } as const;

  readonly dispatcher: Agent;
  private readonly allowed: AddressRanges;
  private readonly refused: AddressRanges;

  constructor(allowList: readonly string[]) {
    const listed = allowList.map((entry) => this.#rangeOf(entry));
    const ipv4Compatible = ipaddr.parseCIDR(AddressPolicy.IPV4_COMPATIBLE);
    this.allowed = { listed };
    this.refused = { ipv4Compatible };

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
    const parsed = ipaddr.process(address);

    if (this.#listedIn(this.allowed, parsed)) return true;

    if (this.#listedIn(this.refused, parsed)) return false;

    return this.#isUnicast(parsed);
  }

  isPrivate(address: string): boolean {
    const parsed = ipaddr.process(address);
    return !this.#isUnicast(parsed);
  }

  async admits(hostname: string): Promise<boolean> {
    const host = this.#unbracketed(hostname);
    const literal = isIP(host) !== 0;

    if (literal) return this.permits(host);

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
      const refusal = this.#refusal();
      callback(refusal, null);
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
          const all = addresses.slice();
          callback(null, all);
          return;
        }

        const [first] = addresses;
        const address = first?.address ?? "";
        const family = first?.family ?? 0;
        callback(null, address, family);
      },
      (error: unknown) => {
        if (error instanceof Error) {
          callback(error, "", 0);
          return;
        }

        const message = String(error);
        const failure = new Error(message);
        callback(failure, "", 0);
      },
    );
  }

  #isUnicast(address: IpAddress): boolean {
    return address.range() === "unicast";
  }

  #listedIn(ranges: AddressRanges, address: IpAddress): boolean {
    const range = ipaddr.subnetMatch(address, ranges, AddressPolicy.UNLISTED);
    return range !== AddressPolicy.UNLISTED;
  }

  #rangeOf(entry: string): AddressRange {
    if (ipaddr.isValidCIDR(entry)) return ipaddr.parseCIDR(entry);

    const address = ipaddr.process(entry);
    const kind = address.kind();
    const bits = AddressPolicy.HOST_BITS[kind];
    return [address, bits];
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
}
