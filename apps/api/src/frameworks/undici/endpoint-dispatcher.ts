import { lookup as resolve, type LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import { Agent, buildConnector, Dispatcher } from 'undici';
import { AddressPolicy, AddressRefusedError } from './address-policy.js';

// Every request to an endpoint an author chose, so tests can replace it with a MockAgent.
export abstract class EndpointDispatcher extends Dispatcher {}

export function createEndpointDispatcher(
  allowList: readonly string[],
): EndpointDispatcher {
  const policy = new AddressPolicy(allowList);
  const lookup = checkedLookup(policy);
  const connector = buildConnector({ lookup });
  return new Agent({
    connect: (options, callback) => {
      const host = options.hostname.replace(/^\[(.*)\]$/, '$1');
      const literal = isIP(host) !== 0;

      if (literal && !policy.permits(host)) {
        callback(new AddressRefusedError(), null);
        return;
      }

      connector(options, callback);
    },
  });
}

function checkedLookup(policy: AddressPolicy): LookupFunction {
  return (hostname, options, callback) => {
    resolve(
      hostname,
      { family: options.family, all: true },
      (error, addresses) => {
        if (error) {
          callback(error, '', 0);
          return;
        }

        const refused = addresses.some(
          (resolved: LookupAddress) => !policy.permits(resolved.address),
        );

        if (refused) {
          callback(new AddressRefusedError(), '', 0);
          return;
        }

        if (options.all) {
          callback(null, addresses);
          return;
        }

        const [first] = addresses;
        callback(null, first?.address ?? '', first?.family ?? 0);
      },
    );
  };
}
