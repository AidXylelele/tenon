import { AddressPolicy } from '../../../src/frameworks/undici/address-policy.js';

describe('address policy', () => {
  it.each(['8.8.8.8', '93.184.216.34', '::ffff:1.1.1.1', '2606:4700::1111'])(
    'a_public_address_%s_is_permitted',
    (address) => {
      const policy = new AddressPolicy([]);

      expect(policy.permits(address)).toBe(true);
    },
  );

  it.each(['127.0.0.1', '::ffff:10.0.0.1', '::127.0.0.1', '::1', '::'])(
    'a_private_address_%s_is_refused',
    (address) => {
      const policy = new AddressPolicy([]);

      expect(policy.permits(address)).toBe(false);
    },
  );
});
