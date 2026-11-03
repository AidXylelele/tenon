import { Clock } from '../../../application/automation/ports.js';
import type { EngineTime } from './interfaces.js';

// The engine's clock, so that use cases and the runs they start read the same time.
export class EngineClock extends Clock {
  constructor(readonly source: EngineTime) {
    super();
  }

  now(): Date {
    const time = this.source.now();
    return new Date(time);
  }
}
