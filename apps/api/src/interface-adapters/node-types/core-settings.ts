import { OnError } from '../../domain/enums.js';
import type { NodeSettings } from '../../domain/interfaces.js';

export const CORE_SETTINGS: NodeSettings = {
  alwaysOutputData: false,
  executeOnce: false,
  retry: { attempts: 1, waitMs: 0 },
  onError: OnError.Stop,
};
