import { Pool } from 'undici';
import type { SandboxPool } from '../../interface-adapters/interfaces.js';

export function createSandboxPool(sandboxUrl: string): SandboxPool {
  return new Pool(sandboxUrl, { connections: 16 });
}
