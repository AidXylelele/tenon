import { InProcessJqClient } from '../../../src/frameworks/jq/in-process-jq.client.js';
import { JqOutcomeKind } from '../../../src/interface-adapters/expressions/enums.js';

describe('InProcessJqClient', () => {
  const client = new InProcessJqClient();

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
});
