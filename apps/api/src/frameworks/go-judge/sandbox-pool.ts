import { Dispatcher, Pool } from 'undici';

export abstract class SandboxPool extends Dispatcher {}

export function createSandboxPool(
  sandboxUrl: string,
  token: string,
): SandboxPool {
  const pool = new Pool(sandboxUrl, { connections: 16 });
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
