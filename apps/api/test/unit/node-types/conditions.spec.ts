import { ConditionSet } from '../../../src/interface-adapters/node-types/conditions/condition-set.js';
import { conditionsSchema } from '../../../src/interface-adapters/node-types/conditions/conditions-schema.js';
import type { Operator } from '../../../src/interface-adapters/node-types/conditions/operators.js';

const rule = (left: unknown, operator: Operator, right?: unknown) => ({
  left,
  operator,
  right,
});

const holds = (
  rules: ReturnType<typeof rule>[],
  options: { combinator?: 'and' | 'or'; ignoreCase?: boolean } = {},
) => new ConditionSet(conditionsSchema.parse({ rules, ...options })).holds();

describe('ConditionSet', () => {
  it.each([
    [rule('kibble', 'string:equals', 'kibble'), true],
    [rule('kibble', 'string:notEquals', 'kibble'), false],
    [rule('salmon kibble', 'string:contains', 'kib'), true],
    [rule('salmon', 'string:notContains', 'kib'), true],
    [rule('salmon', 'string:startsWith', 'sal'), true],
    [rule('salmon', 'string:endsWith', 'mon'), true],
    [rule('order-42', 'string:matches', '^order-\\d+$'), true],
    [rule('order-x', 'string:notMatches', '^order-\\d+$'), true],
    [rule('', 'string:isEmpty'), true],
    [rule('a', 'string:isNotEmpty'), true],
    [rule(5, 'number:equals', 5), true],
    [rule('5', 'number:equals', 5), true],
    [rule(5, 'number:notEquals', 6), true],
    [rule(5, 'number:gt', 4), true],
    [rule(5, 'number:gte', 5), true],
    [rule(5, 'number:lt', 4), false],
    [rule(5, 'number:lte', 5), true],
    [rule('2026-10-16T10:00:00Z', 'date:after', '2026-10-15'), true],
    [rule('2026-10-16T10:00:00Z', 'date:before', '2026-10-15'), false],
    [
      rule(
        '2026-10-16T10:00:00.000Z',
        'date:equals',
        '2026-10-16T13:00:00.000+03:00',
      ),
      true,
    ],
    [rule(true, 'boolean:isTrue'), true],
    [rule(false, 'boolean:isFalse'), true],
    [rule(['a', 'b'], 'array:contains', 'a'), true],
    [rule(['a', 'b'], 'array:notContains', 'c'), true],
    [rule(['a', 'b'], 'array:lengthEquals', 2), true],
    [rule(['a', 'b'], 'array:lengthGt', 1), true],
    [rule(['a', 'b'], 'array:lengthLt', 2), false],
    [rule([], 'array:isEmpty'), true],
    [rule(['a'], 'array:isNotEmpty'), true],
    [rule({}, 'object:isEmpty'), true],
    [rule({ a: 1 }, 'object:isNotEmpty'), true],
    [rule('x', 'exists'), true],
    [rule(undefined, 'exists'), false],
    [rule(null, 'notExists'), true],
  ])('the_condition_%j_is_%s', (condition, expected) => {
    expect(holds([condition])).toBe(expected);
  });

  it('values_of_the_wrong_kind_never_match_instead_of_failing', () => {
    expect(holds([rule('abc', 'number:gt', 1)])).toBe(false);
    expect(holds([rule('not a date', 'date:after', '2026-01-01')])).toBe(false);
    expect(holds([rule('abc', 'array:contains', 'a')])).toBe(false);
  });

  it('all_rules_must_hold_with_and_and_one_is_enough_with_or', () => {
    const rules = [rule(1, 'number:equals', 1), rule(1, 'number:equals', 2)];
    expect(holds(rules)).toBe(false);
    expect(holds(rules, { combinator: 'or' })).toBe(true);
  });

  it('text_comparisons_can_ignore_case', () => {
    expect(holds([rule('Kibble', 'string:equals', 'kibble')])).toBe(false);
    expect(
      holds([rule('Kibble', 'string:equals', 'kibble')], { ignoreCase: true }),
    ).toBe(true);
    expect(
      holds([rule('ORDER', 'string:matches', '^order$')], { ignoreCase: true }),
    ).toBe(true);
  });

  it('a_pattern_outside_the_linear_time_syntax_is_refused_by_the_schema', () => {
    const result = conditionsSchema.safeParse({
      rules: [rule('a', 'string:matches', '(a)\\1')],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['rules', 0, 'right'],
      params: { problem: 'invalid-regex' },
    });
  });
});
