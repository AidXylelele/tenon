import { BlockList, isIP } from 'node:net';

const REFUSED_IPV4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const REFUSED_IPV6: readonly (readonly [string, number])[] = [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

export class AddressRefusedError extends Error {
  readonly code = 'ERR_ADDRESS_REFUSED';

  constructor() {
    super(
      'The address is private, loopback or link-local and not allow-listed',
    );
  }
}

export class AddressPolicy {
  readonly #refused = new BlockList();
  readonly #allowed = new BlockList();

  constructor(allowList: readonly string[]) {
    for (const [network, prefix] of REFUSED_IPV4) {
      this.#refused.addSubnet(network, prefix, 'ipv4');
    }

    for (const [network, prefix] of REFUSED_IPV6) {
      this.#refused.addSubnet(network, prefix, 'ipv6');
    }

    for (const entry of allowList) {
      this.#allow(entry);
    }
  }

  permits(address: string): boolean {
    const family = familyOf(address);

    if (this.#allowed.check(address, family)) return true;

    return !this.#refused.check(address, family);
  }

  #allow(entry: string): void {
    const [network = '', prefix] = entry.split('/');
    const family = familyOf(network);

    if (prefix === undefined) {
      this.#allowed.addAddress(network, family);
      return;
    }

    const length = Number(prefix);
    this.#allowed.addSubnet(network, length, family);
  }
}

function familyOf(address: string): 'ipv4' | 'ipv6' {
  const version = isIP(address);

  if (version === 4) return 'ipv4';

  if (version === 6) return 'ipv6';

  throw new TypeError(`"${address}" is not an IP address`);
}
