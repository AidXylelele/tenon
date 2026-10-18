import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';
import { CryptoNode } from '../../../src/interface-adapters/node-types/types/crypto.node.js';
import { field, fixed, runNode } from '../../support/node-runs.js';

const items = [{ name: 'kibble' }, { name: 'litter' }];

const crypto = (
  parameters: Record<string, unknown>,
  input: Record<string, unknown>[] = items,
) => runNode(new CryptoNode(), { items: input, parameters });

const hashOf = async (algorithm: string, value: string) => {
  const result = await crypto(
    { algorithm: fixed(algorithm), value: fixed(value) },
    [{}],
  );
  return result.main?.[0]?.data;
};

describe('Crypto', () => {
  it('hashes_the_value_of_each_item_with_sha256_in_hex_by_default', async () => {
    const result = await crypto({ value: field('name') });
    expect(result.main).toEqual([
      {
        name: 'kibble',
        data: '6f275596f834c93e96f909ad632034c19a8af6e3eb06c682d7fd2bd8c446f428',
      },
      {
        name: 'litter',
        data: 'ff4a41f6aa62a1c97c05f417189213be3749d73faf7fd6b3bc4481c1df9f2aa7',
      },
    ]);
  });

  it('hashes_with_md5_sha1_sha384_and_sha512', async () => {
    expect(await hashOf('MD5', 'abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(await hashOf('SHA1', 'abc')).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    );
    expect(await hashOf('SHA384', 'abc')).toBe(
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    );
    expect(await hashOf('SHA512', 'abc')).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('hashes_with_sha3_256_sha3_384_and_sha3_512', async () => {
    expect(await hashOf('SHA3-256', 'abc')).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
    );
    expect(await hashOf('SHA3-384', 'abc')).toBe(
      'ec01498288516fc926459f58e2c6ad8df9b473cb0fc08c2596da7cf0e49be4b298d88cea927ac7f539f1edf228376d25',
    );
    expect(await hashOf('SHA3-512', 'abc')).toBe(
      'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0',
    );
  });

  it('hashes_the_value_as_utf8_text', async () => {
    expect(await hashOf('MD5', 'café')).toBe(
      '07117fe4a1ebd544965dc19573183da2',
    );
  });

  it('encodes_the_digest_in_base64', async () => {
    const result = await crypto(
      { value: fixed('abc'), encoding: fixed('base64') },
      [{}],
    );
    expect(result.main).toEqual([
      { data: 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=' },
    ]);
  });

  it('hashes_an_empty_value_by_default', async () => {
    const result = await crypto({}, [{}]);
    expect(result.main).toEqual([
      {
        data: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    ]);
  });

  it('writes_into_the_output_field_by_dot_path_and_keeps_the_item', async () => {
    const result = await crypto({
      algorithm: fixed('MD5'),
      value: fixed('abc'),
      outputField: fixed('meta.checksum'),
    });
    expect(result.main?.[1]).toEqual({
      name: 'litter',
      meta: { checksum: '900150983cd24fb0d6963f7d28e17f72' },
    });
  });

  it('generates_a_different_uuid_for_each_item', async () => {
    const result = await crypto({ operation: fixed('generate') });
    const [first, second] = result.main?.map((item) => item.data) ?? [];
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(first).toMatch(uuid);
    expect(second).toMatch(uuid);
    expect(first).not.toBe(second);
    expect(result.main?.[0]?.name).toBe('kibble');
  });

  it('generates_32_random_bytes_in_hex_by_default', async () => {
    const result = await crypto(
      { operation: fixed('generate'), kind: fixed('random') },
      [{}],
    );
    expect(result.main?.[0]?.data).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates_the_chosen_number_of_random_bytes_in_base64', async () => {
    const result = await crypto(
      {
        operation: fixed('generate'),
        kind: fixed('random'),
        length: fixed(3),
        encoding: fixed('base64'),
      },
      [{}],
    );
    expect(result.main?.[0]?.data).toMatch(/^[A-Za-z0-9+/]{4}$/);
  });

  it('a_random_length_outside_1_to_1024_fails_the_node_with_the_parameter', async () => {
    const generate = (length: number) =>
      crypto({
        operation: fixed('generate'),
        kind: fixed('random'),
        length: fixed(length),
      });
    await expect(generate(0)).rejects.toBeInstanceOf(NodeUserError);
    await expect(generate(0)).rejects.toMatchObject({
      parameter: 'length',
      item: 0,
    });
    await expect(generate(1025)).rejects.toMatchObject({ parameter: 'length' });
  });

  it('an_unknown_algorithm_fails_the_node_with_the_parameter', async () => {
    await expect(
      crypto({ algorithm: fixed('SHA224'), value: fixed('abc') }),
    ).rejects.toMatchObject({ parameter: 'algorithm', item: 0 });
  });

  it('accepts_only_a_fixed_operation', () => {
    expect(new CryptoNode().fixedParameters).toEqual(['operation']);
  });
});
