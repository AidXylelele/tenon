import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Item } from '../../../src/application/interfaces.js';
import { NodeExecution } from '../../../src/interface-adapters/node-types/node-execution.js';
import { NodeLimitError } from '../../../src/interface-adapters/node-types/node-limit-error.js';
import { NodeUserError } from '../../../src/interface-adapters/node-types/node-user-error.js';

const schema = z.strictObject({
  total: z.number(),
  label: z.string().default('none'),
});

const execution = (
  parameters: Record<string, unknown>,
  inputs: Record<string, Item[]> = { main: [{ price: 1 }, { price: 'two' }] },
  firstItemOnly = false,
  limits = { items: 10_000, bytes: 16 * 1024 * 1024 },
) =>
  new NodeExecution({
    schema,
    limits,
    parameters,
    inputs: new Map(Object.entries(inputs)),
    upstream: [],
    firstItemOnly,
    now: DateTime.fromISO('2026-10-16T10:00:00.000Z'),
    timezone: 'UTC',
    execution: {
      id: 'run-1',
      mode: 'test',
      startedAt: '2026-10-16T10:00:00.000Z',
    },
    workflow: { id: 'wf-1', name: 'Orders', version: null },
  });

const caught = (work: () => unknown) => {
  try {
    work();
  } catch (error) {
    return error;
  }
  throw new Error('expected a failure');
};

describe('NodeExecution', () => {
  it('parameters_are_resolved_for_each_item_and_take_their_defaults', () => {
    const run = execution({ total: { ref: { node: '$item', path: 'price' } } });
    expect(run.parametersOf(0)).toEqual({ total: 1, label: 'none' });
  });

  it('a_resolved_value_that_does_not_fit_the_node_fails_with_the_parameter_and_the_item', () => {
    const run = execution({ total: { ref: { node: '$item', path: 'price' } } });
    const error = caught(() => run.parametersOf(1));
    expect(error).toBeInstanceOf(NodeUserError);
    expect(error).toMatchObject({ parameter: 'total', item: 1 });
  });

  it('a_formula_that_cannot_be_evaluated_fails_with_its_parameter', () => {
    const run = execution({ total: { formula: '{{ $json.missing.price }}' } });
    expect(caught(() => run.parametersOf(0))).toMatchObject({
      parameter: 'total',
      item: 0,
    });
  });

  it('a_formula_beyond_its_bounds_fails_with_a_limit', () => {
    const run = execution({
      total: { fixed: 1 },
      label: { formula: '{{ "a".repeat(2000000) }}' },
    });
    expect(caught(() => run.parametersOf(0))).toBeInstanceOf(NodeLimitError);
  });

  it('resolved_parameters_beyond_the_step_byte_limit_fail_with_a_limit', () => {
    const run = execution(
      { total: { fixed: 1 }, label: { formula: "{{ 'x'.repeat(400) }}" } },
      { main: [{}, {}, {}] },
      false,
      { items: 10_000, bytes: 1_000 },
    );
    run.parametersOf(0);
    run.parametersOf(1);
    expect(caught(() => run.parametersOf(2))).toBeInstanceOf(NodeLimitError);
  });

  it('parameters_once_are_resolved_against_the_first_item', () => {
    const run = execution({ total: { formula: '{{ $json.price * 10 }}' } });
    expect(run.parameters()).toEqual({ total: 10, label: 'none' });
  });

  it('parameters_without_input_items_are_resolved_against_an_empty_item', () => {
    const run = execution({ total: { fixed: 3 } }, { main: [] });
    expect(run.parameters()).toEqual({ total: 3, label: 'none' });
  });

  it('the_items_of_each_input_port_are_available_and_the_main_items_are_the_first_port', () => {
    const run = execution(
      { total: { fixed: 1 } },
      { input1: [{ a: 1 }], input2: [{ b: 2 }, { b: 3 }] },
    );
    expect(run.items).toEqual([{ a: 1 }]);
    expect(run.input('input2')).toEqual([{ b: 2 }, { b: 3 }]);
    expect(run.input('missing')).toEqual([]);
  });

  it('a_node_set_to_execute_once_receives_only_the_first_item_of_each_input', () => {
    const run = execution(
      { total: { fixed: 1 } },
      { main: [{ a: 1 }, { a: 2 }] },
      true,
    );
    expect(run.items).toEqual([{ a: 1 }]);
  });
});
