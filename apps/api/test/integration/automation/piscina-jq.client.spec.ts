import { ResilienceService } from '@nestjs/resilience';
import { Test } from '@nestjs/testing';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { PiscinaJqClient } from '../../../src/frameworks/jq/piscina-jq.client.js';
import { JqOutcomeKind } from '../../../src/interface-adapters/workflows/expressions/enums.js';

describe('PiscinaJqClient', () => {
  let client: PiscinaJqClient;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const resilience = moduleRef.get(ResilienceService);
    client = new PiscinaJqClient(resilience);
  });

  afterAll(async () => {
    await client.onApplicationShutdown();
  });

  it('a_program_compiles_with_the_variables_it_mentions', async () => {
    const compilation = await client.compile(
      '.items | map(. * $context.rate) | $input.base + add',
    );

    expect(compilation).toEqual({ kind: JqOutcomeKind.Compiled });
  });

  it('a_program_is_compiled_and_never_run', async () => {
    const compilation = await client.compile('error("never raised")');

    expect(compilation).toEqual({ kind: JqOutcomeKind.Compiled });
  });

  it.each([
    ['.a | map(. + )', "syntax error, unexpected ')'"],
    ['.a | shout(1)', 'shout/1 is not defined'],
  ])(
    'a_compile_error_is_given_without_the_program_echo_%s',
    async (program, failure) => {
      const compilation = await client.compile(program);

      expect(compilation).toEqual({ kind: JqOutcomeKind.Failure, failure });
    },
  );

  it('an_evaluation_gives_every_output_of_the_program', async () => {
    const evaluation = await client.evaluate(
      '.items[] * $rate',
      { items: [1, 2] },
      { rate: 3 },
    );

    expect(evaluation).toEqual({
      kind: JqOutcomeKind.Evaluated,
      values: [3, 6],
    });
  });

  it('a_runaway_program_is_stopped_after_one_second', async () => {
    const started = performance.now();
    const evaluation = await client.evaluate(
      'reduce range(1000000000) as $i (0; . + 1)',
      null,
      {},
    );
    const elapsed = performance.now() - started;

    expect(evaluation).toEqual({ kind: JqOutcomeKind.TimedOut });
    expect(elapsed).toBeLessThan(2000);
  });

  it('a_program_that_exhausts_its_memory_is_aborted', async () => {
    const evaluation = await client.evaluate(
      '[range(1000000000)] | length',
      null,
      {},
    );

    expect([JqOutcomeKind.Aborted, JqOutcomeKind.TimedOut]).toContain(
      evaluation.kind,
    );
  });

  it('programs_run_again_after_a_worker_was_stopped', async () => {
    await client.evaluate(
      'reduce range(1000000000) as $i (0; . + 1)',
      null,
      {},
    );
    const programs = Array.from({ length: 20 }, (_, index) =>
      client.evaluate('. + 1', index, {}),
    );
    const evaluations = await Promise.all(programs);

    const values = evaluations.map((evaluation) =>
      evaluation.kind === JqOutcomeKind.Evaluated ? evaluation.values[0] : null,
    );
    const expected = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(values).toEqual(expected);
  });
});
