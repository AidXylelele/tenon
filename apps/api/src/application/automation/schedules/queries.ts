import type { ExpectedStarts } from "./interfaces.js";

export abstract class ScheduleQueries {
  abstract expected(from: Date): Promise<ExpectedStarts[]>;
}
