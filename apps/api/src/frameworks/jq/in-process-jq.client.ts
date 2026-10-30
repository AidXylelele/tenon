import { Injectable } from '@nestjs/common';
import { raw } from 'jq-wasm';
import { JqOutcomeKind } from '../../interface-adapters/expressions/enums.js';
import {
  JqClient,
  type JqCompilation,
} from '../../interface-adapters/expressions/interfaces.js';

@Injectable()
export class InProcessJqClient implements JqClient {
  private static readonly VARIABLE = /\$[A-Za-z_][A-Za-z0-9_]*/g;
  private static readonly ERROR_PREFIX = /^jq: error(?: \(at [^)]*\))?: /;
  private static readonly LOCATION =
    / at <top-level>, line \d+, column \d+:[\s\S]*$/;
  private static readonly UNBOUND = 'null';

  async compile(program: string): Promise<JqCompilation> {
    const bindings = this.#bindings(program);
    const query = `empty | (${program})`;
    const result = await raw(null, query, bindings);

    if (result.exitCode === 0) return { kind: JqOutcomeKind.Compiled };

    const failure = result.stderr
      .trim()
      .replace(InProcessJqClient.ERROR_PREFIX, '')
      .replace(InProcessJqClient.LOCATION, '');
    return { kind: JqOutcomeKind.Failure, failure };
  }

  #bindings(program: string): string[] {
    const names = new Set<string>();

    for (const mention of program.matchAll(InProcessJqClient.VARIABLE)) {
      const name = mention[0].slice(1);
      names.add(name);
    }

    const flags: string[] = [];

    for (const name of names)
      flags.push('--argjson', name, InProcessJqClient.UNBOUND);

    return flags;
  }
}
