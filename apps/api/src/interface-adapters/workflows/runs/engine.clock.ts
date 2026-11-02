import type { Clock } from '../../../application/automation/language/ports.js';
import type { EngineTime } from './interfaces.js';

export class EngineClock implements Clock {
  constructor(readonly source: EngineTime) {}

  now(): Date {
    const time = this.source.now();
    return new Date(time);
  }
}
