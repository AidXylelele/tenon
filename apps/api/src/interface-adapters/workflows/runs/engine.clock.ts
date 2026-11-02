import { Clock } from '../../../application/automation/language/ports.js';
import type { EngineTime } from './interfaces.js';

export class EngineClock extends Clock {
  constructor(readonly source: EngineTime) {
    super();
  }

  now(): Date {
    const time = this.source.now();
    return new Date(time);
  }
}
