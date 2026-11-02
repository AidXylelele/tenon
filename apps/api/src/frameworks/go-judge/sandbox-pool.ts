import { Dispatcher, Pool } from 'undici';
import { GoJudgeOutput } from '../../interface-adapters/sandbox/enums.js';
import type { SandboxLimits } from '../../interface-adapters/sandbox/interfaces.js';

export abstract class SandboxPool extends Dispatcher {}

// go-judge answers in JSON, where one byte of output takes at most six (`\u0000`, `\u003c`),
// and an answer holds its capped output files besides its envelope.
const ESCAPED_BYTE = 6;
const ENVELOPE_BYTES = 64 * 1024;

export function createSandboxPool(
  sandboxUrl: string,
  token: string,
  limits: SandboxLimits,
): SandboxPool {
  const files = Object.values(GoJudgeOutput).length;
  const escaped = limits.outputBytes * ESCAPED_BYTE * files;
  const maxResponseSize = escaped + ENVELOPE_BYTES;
  const pool = new Pool(sandboxUrl, { connections: 16, maxResponseSize });
  const authorization = `Bearer ${token}`;
  return pool.compose(
    (dispatch) => (options: Dispatcher.DispatchOptions, handler) => {
      const headers = new Headers();
      const declared = options.headers;

      if (declared && !Array.isArray(declared))
        for (const [name, value] of Object.entries(declared))
          if (typeof value === 'string') headers.set(name, value);

      headers.set('authorization', authorization);
      const authorized = Object.fromEntries(headers);
      return dispatch({ ...options, headers: authorized }, handler);
    },
  );
}
