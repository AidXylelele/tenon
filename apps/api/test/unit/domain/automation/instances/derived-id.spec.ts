import { DerivedId } from '../../../../../src/domain/automation/instances/derived-id.js';

describe('DerivedId', () => {
  it('the_same_parts_derive_the_same_name_based_uuid', () => {
    const first = DerivedId.of(['instance-1', '0']);
    const again = DerivedId.of(['instance-1', '0']);
    const other = DerivedId.of(['instance-1', '1']);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('parts_are_kept_apart_so_their_joins_never_collide', () => {
    const joined = DerivedId.of(['a/b', 'c']);
    const split = DerivedId.of(['a', 'b/c']);

    expect(joined).not.toBe(split);
  });
});
