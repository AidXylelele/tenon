import { DateTime } from 'luxon';
import { FormulaError } from '../../../src/interface-adapters/formulas/formula-error.js';
import { Formula } from '../../../src/interface-adapters/formulas/formula.js';
import { FormulaScope } from '../../../src/interface-adapters/formulas/formula-scope.js';

const scope = (
  overrides: Partial<ConstructorParameters<typeof FormulaScope>[0]> = {},
) =>
  new FormulaScope({
    item: {
      name: 'kibble',
      price: 10,
      tags: ['cat', 'food'],
      nested: { a: { b: 2 } },
    },
    itemIndex: 1,
    input: [{ name: 'first' }, { name: 'kibble', price: 10 }, { name: 'last' }],
    nodes: new Map([
      ['Fetch', [{ id: 1 }, { id: 2 }, { id: 3 }]],
      ['Empty', []],
    ]),
    now: DateTime.fromISO('2026-10-16T22:30:00.000Z'),
    timezone: 'Europe/Kyiv',
    execution: {
      id: 'run-1',
      mode: 'test',
      startedAt: '2026-10-16T22:29:00.000Z',
    },
    workflow: { id: 'wf-1', name: 'Orders', version: 3 },
    ...overrides,
  });

const evaluate = (source: string, context = scope()) =>
  Formula.parse(source).evaluate(context);

const failure = (source: string, context = scope()) => {
  try {
    evaluate(source, context);
  } catch (error) {
    if (error instanceof FormulaError) return error;
    throw error;
  }
  throw new Error(`"${source}" was expected to fail`);
};

const parseFailure = (source: string) => {
  try {
    Formula.parse(source);
  } catch (error) {
    if (error instanceof FormulaError) return error;
    throw error;
  }
  throw new Error(`"${source}" was expected to be refused`);
};

describe('Formula', () => {
  it('an_error_thrown_by_a_builtin_is_an_evaluation_failure_of_the_formula', () => {
    expect(failure('{{ JSON.parse($json.name) }}').code).toBe('evaluation');
    expect(failure('{{ [...$json.price] }}').code).toBe('evaluation');
    expect(failure('{{ $json.name.repeat(-1) }}').code).toBe('evaluation');
  });

  it('an_object_spread_copies_a_proto_key_as_data_and_keeps_the_prototype', () => {
    const item = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}') as Record<
      string,
      unknown
    >;
    const spread = evaluate('{{ { ...$json } }}', scope({ item })) as Record<
      string,
      unknown
    >;
    expect(Object.getPrototypeOf(spread)).toBe(Object.prototype);
    expect(Object.hasOwn(spread, '__proto__')).toBe(true);
    expect(spread['polluted']).toBeUndefined();
    expect(spread['a']).toBe(2);
  });

  describe('values', () => {
    it('text_without_expressions_is_returned_as_it_is', () => {
      expect(evaluate('Hello')).toBe('Hello');
    });

    it('a_single_expression_returns_its_value_with_its_type', () => {
      expect(evaluate('{{ $json.price * 1.5 }}')).toBe(15);
      expect(evaluate('{{ $json.nested }}')).toEqual({ a: { b: 2 } });
      expect(evaluate(' {{ $json.tags }} ')).toEqual(['cat', 'food']);
    });

    it('expressions_inside_text_are_written_into_it', () => {
      expect(evaluate('Item {{ $json.name }} costs {{ $json.price }}')).toBe(
        'Item kibble costs 10',
      );
      expect(evaluate('Tags: {{ $json.tags }}')).toBe('Tags: ["cat","food"]');
    });

    it('a_missing_field_resolves_to_empty_instead_of_failing', () => {
      expect(evaluate('{{ $json.missing }}')).toBeUndefined();
      expect(evaluate('{{ $json.missing?.deeper }}')).toBeUndefined();
      expect(evaluate('Value: {{ $json.missing }}')).toBe('Value: ');
    });

    it('operators_conditions_and_literals_work_as_in_javascript', () => {
      expect(evaluate('{{ $json.price > 5 && $json.name === "kibble" }}')).toBe(
        true,
      );
      expect(evaluate('{{ $json.price > 50 ? "big" : "small" }}')).toBe(
        'small',
      );
      expect(evaluate('{{ $json.missing ?? "none" }}')).toBe('none');
      expect(evaluate('{{ `${$json.name}!` }}')).toBe('kibble!');
      expect(
        evaluate('{{ { total: $json.price * 2, list: [1, 2] } }}'),
      ).toEqual({
        total: 20,
        list: [1, 2],
      });
      expect(evaluate('{{ $json.nested["a"].b }}')).toBe(2);
      expect(evaluate('{{ -$json.price + 2 ** 3 % 5 }}')).toBe(-7);
      expect(evaluate('{{ typeof $json.name }}')).toBe('string');
    });

    it('allow_listed_methods_of_strings_numbers_and_lists_can_be_called', () => {
      expect(evaluate('{{ $json.name.toUpperCase() }}')).toBe('KIBBLE');
      expect(evaluate('{{ "a,b".split(",") }}')).toEqual(['a', 'b']);
      expect(evaluate('{{ $json.tags.join(" & ") }}')).toBe('cat & food');
      expect(evaluate('{{ $json.tags.includes("cat") }}')).toBe(true);
      expect(evaluate('{{ $json.tags.length }}')).toBe(2);
      expect(evaluate('{{ (1.256).toFixed(2) }}')).toBe('1.26');
    });

    it('allow_listed_global_helpers_can_be_called', () => {
      expect(evaluate('{{ Math.round(2.6) }}')).toBe(3);
      expect(evaluate('{{ JSON.stringify($json.nested) }}')).toBe(
        '{"a":{"b":2}}',
      );
      expect(evaluate('{{ Object.keys($json.nested) }}')).toEqual(['a']);
      expect(evaluate('{{ Number("42") + 1 }}')).toBe(43);
      expect(evaluate('{{ String(5) }}')).toBe('5');
    });
  });

  describe('variables', () => {
    it('input_items_are_read_as_n8n_items', () => {
      expect(evaluate('{{ $input.all().length }}')).toBe(3);
      expect(evaluate('{{ $input.first().json.name }}')).toBe('first');
      expect(evaluate('{{ $input.last().json.name }}')).toBe('last');
      expect(evaluate('{{ $input.item.json.name }}')).toBe('kibble');
    });

    it('an_upstream_node_is_read_by_name_and_its_same_position_item_by_item', () => {
      expect(evaluate("{{ $('Fetch').item.json.id }}")).toBe(2);
      expect(evaluate("{{ $('Fetch').first().json.id }}")).toBe(1);
      expect(evaluate("{{ $('Fetch').all().length }}")).toBe(3);
    });

    it('a_node_that_has_not_run_resolves_to_empty', () => {
      expect(evaluate("{{ $('Empty').first() }}")).toBeUndefined();
      expect(evaluate("{{ $('Never').all() }}")).toEqual([]);
      expect(evaluate("{{ $('Never').item?.json.id }}")).toBeUndefined();
    });

    it('the_current_time_and_date_are_in_the_workflow_time_zone', () => {
      expect(evaluate('{{ $now.toISO() }}')).toBe(
        '2026-10-17T01:30:00.000+03:00',
      );
      expect(evaluate('{{ $today.toFormat("yyyy-MM-dd") }}')).toBe(
        '2026-10-17',
      );
      expect(
        evaluate('{{ $now.plus({ days: 1 }).toFormat("yyyy-MM-dd") }}'),
      ).toBe('2026-10-18');
      expect(evaluate('{{ $now.year }}')).toBe(2026);
    });

    it('the_run_and_the_workflow_are_described', () => {
      expect(evaluate('{{ $execution.id }}')).toBe('run-1');
      expect(evaluate('{{ $execution.mode }}')).toBe('test');
      expect(evaluate('{{ $workflow.name }} v{{ $workflow.version }}')).toBe(
        'Orders v3',
      );
    });
  });

  describe('safety', () => {
    it.each([
      ['{{ (x) => x }}'],
      ['{{ function () { return 1 } }}'],
      ['{{ $json.price = 1 }}'],
      ['{{ $json.price++ }}'],
      ['{{ new Date() }}'],
      ['{{ this }}'],
      ['{{ /a+/.test("a") }}'],
      ['{{ $json.a, $json.b }}'],
      ['{{ $json`x` }}'],
    ])('the_construct_in_%s_is_refused_as_a_syntax_problem', (source) => {
      expect(parseFailure(source).code).toBe('syntax');
    });

    it.each([
      ['{{ process }}'],
      ['{{ globalThis }}'],
      ['{{ require("fs") }}'],
      ['{{ foo }}'],
    ])('the_name_in_%s_is_outside_the_formula_scope', (source) => {
      expect(parseFailure(source).code).toBe('scope');
    });

    it('prototype_members_cannot_be_reached', () => {
      expect(failure('{{ $json.constructor }}').code).toBe('evaluation');
      expect(failure('{{ $json["__proto__"] }}').code).toBe('evaluation');
      expect(
        parseFailure(
          '{{ $json.name.constructor.constructor("return process")() }}',
        ).code,
      ).toBe('syntax');
      expect(failure('{{ $json.toString() }}').code).toBe('evaluation');
    });

    it('a_method_cannot_be_taken_as_a_value', () => {
      expect(failure('{{ $json.name.toUpperCase }}').code).toBe('evaluation');
      expect(failure('{{ Math.round }}').code).toBe('evaluation');
    });

    it('a_result_above_one_megabyte_fails_with_a_limit', () => {
      expect(failure('{{ "a".repeat(2000000) }}').code).toBe('limit');
      expect(
        failure('{{ "ab".repeat(400000) + "ab".repeat(400000) }}').code,
      ).toBe('limit');
    });

    it('a_syntax_error_names_its_position', () => {
      const error = parseFailure('Total: {{ $json. }}');
      expect(error.code).toBe('syntax');
      expect(error.message).toMatch(/position \d+/);
    });

    it('an_unclosed_expression_is_a_syntax_problem', () => {
      expect(parseFailure('{{ $json.name ').code).toBe('syntax');
    });
  });

  describe('node names', () => {
    it('a_formula_lists_the_nodes_it_names', () => {
      expect(
        Formula.parse(`{{ $('Fetch').item.json.id }} {{ $("Other").first() }}`)
          .nodeNames,
      ).toEqual(['Fetch', 'Other']);
    });

    it('renaming_a_node_rewrites_only_the_references_to_it', () => {
      expect(
        Formula.parse(
          `{{ $('Old').item.json.x + 'Old' }} and {{ $("Old").all() }}`,
        ).renameNodes(new Map([['Old', 'New']])),
      ).toBe(`{{ $('New').item.json.x + 'Old' }} and {{ $("New").all() }}`);
    });

    it('swapped_names_are_rewritten_at_once', () => {
      expect(
        Formula.parse(
          "{{ $('A').item.json.x + $('B').item.json.y }}",
        ).renameNodes(
          new Map([
            ['A', 'B'],
            ['B', 'A'],
          ]),
        ),
      ).toBe("{{ $('B').item.json.x + $('A').item.json.y }}");
    });
  });
});
