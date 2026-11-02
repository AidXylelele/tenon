import { Phase } from '../../../src/domain/automation/language/phase.js';
import {
  ListInstancesQuery,
  PageQuery,
} from '../../../src/interface-adapters/api/schemas/instance.schemas.js';

describe('the instance schemas', () => {
  // The presenters cast the domain's phase names to these, so a drifted name would compile.
  it('the_phases_a_query_accepts_are_the_standard_s_phases_of_the_domain', () => {
    const accepted = ListInstancesQuery.shape.phase.unwrap().options;
    const phases = Object.values(Phase).filter(
      (value): value is Phase => value instanceof Phase,
    );
    const names = phases.map((phase) => phase.name);

    expect([...accepted].sort()).toEqual([...names].sort());
  });

  it.each([
    'NaN_6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    '01_6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    '-5_6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    '5_not-an-id',
  ])('the_instance_cursor_%s_is_refused', (cursor) => {
    const parsed = ListInstancesQuery.safeParse({ cursor });

    expect(parsed.success).toBe(false);
  });

  it.each(['-1', '1e3', '01', '1.5'])(
    'the_position_cursor_%s_is_refused',
    (cursor) => {
      const parsed = PageQuery.safeParse({ cursor });

      expect(parsed.success).toBe(false);
    },
  );

  it('a_cursor_the_api_gives_out_is_accepted', () => {
    const instance = ListInstancesQuery.safeParse({
      cursor: '1793622878303_6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    });
    const position = PageQuery.safeParse({ cursor: '42' });

    expect(instance.success).toBe(true);
    expect(position.success).toBe(true);
  });
});
