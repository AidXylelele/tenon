import { createJqPool } from '../../../src/frameworks/jq/jq-pool.js';
import type {
  JqPool,
  JqTask,
} from '../../../src/interface-adapters/interfaces.js';

function task(program: string, input: unknown = null): JqTask {
  const text = JSON.stringify(input);
  return { program, input: text, arguments: {} };
}

describe('jq pool', () => {
  let pool: JqPool;

  beforeAll(() => {
    pool = createJqPool();
  });

  afterAll(async () => {
    await pool.destroy();
  });

  it('an_expression_reads_its_input_and_its_named_arguments', async () => {
    const outcome = await pool.run({
      program: '.a + $offset',
      input: '{"a":1}',
      arguments: { offset: '41' },
    });

    expect(outcome).toEqual({ values: [42] });
  });

  it.each([
    'env',
    'input',
    'inputs',
    'input_filename',
    'halt',
    'halt_error',
    'localtime',
  ])('the_%s_builtin_is_not_available', async (builtin) => {
    const outcome = await pool.run(task(builtin));

    expect(outcome).toEqual({ failure: `${builtin} is not available` });
  });

  it('the_environment_variable_is_empty', async () => {
    const outcome = await pool.run(task('$ENV'));

    expect(outcome).toEqual({ values: [{}] });
  });

  it('a_syntax_error_is_reported_without_the_program_text', async () => {
    const outcome = await pool.run(task('.a | map(. + )'));

    expect(outcome).toEqual({ failure: "syntax error, unexpected ')'" });
  });

  it('a_catastrophic_regular_expression_fails_instead_of_hanging', async () => {
    const outcome = await pool.run(
      task('test("^(a+)+$")', `${'a'.repeat(64)}b`),
    );

    expect(outcome).toEqual({
      failure: expect.stringContaining('Regex failure') as unknown,
    });
  });

  it.each([
    ['an_endless_loop', 'last(range(1e15))', null],
    ['an_exploding_output', '[range(1e9)] | length', null],
  ])(
    '%s_is_stopped_when_its_time_runs_out_and_the_pool_keeps_working',
    async (_, program, input) => {
      const timeout = AbortSignal.timeout(1_000);
      const stopped = pool.run(task(program, input), { signal: timeout });

      await expect(stopped).rejects.toThrow();

      const next = await pool.run(task('1 + 1'));
      expect(next).toEqual({ values: [2] });
    },
  );
});
