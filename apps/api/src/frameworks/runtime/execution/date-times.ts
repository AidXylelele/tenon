import type { JsonObject } from '../../../domain/automation/json.js';

// A point in time as expressions read it (DSL 1.0.3, "DateTime Descriptor").
export class DateTimes {
  static readonly #MS_PER_SECOND = 1_000;

  static descriptorOf(milliseconds: number): JsonObject {
    const iso8601 = new Date(milliseconds).toISOString();
    const seconds = Math.floor(milliseconds / DateTimes.#MS_PER_SECOND);
    return { iso8601, epoch: { seconds, milliseconds } };
  }
}
