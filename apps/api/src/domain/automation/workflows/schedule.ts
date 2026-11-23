import { CronTime, validateCronExpression } from "cron";
import type { Result } from "../../interfaces.js";
import { ScheduleKind } from "./enums.js";
import type { PassedSlots, ScheduleSpec } from "./interfaces.js";

export class Schedule {
  static readonly #ZONE = "UTC";
  static readonly #REFERENCE = new Date(Date.UTC(2000, 0, 1));
  static readonly #MOST_COUNTED = 1_000;

  readonly #spec: ScheduleSpec;
  readonly #cron: CronTime | null;

  constructor(spec: ScheduleSpec) {
    this.#spec = spec;
    this.#cron = Schedule.#cronOf(spec);
  }

  static of(spec: ScheduleSpec): Result<Schedule, string> {
    const problem = Schedule.#problemOf(spec);

    if (problem !== null) return { ok: false, failure: problem };

    const schedule = new Schedule(spec);
    return { ok: true, value: schedule };
  }

  get spec(): ScheduleSpec {
    return this.#spec;
  }

  get chained(): boolean {
    return this.#spec.kind === ScheduleKind.After;
  }

  armedAt(now: Date): number | null {
    if (this.chained) return now.getTime();

    return this.followingAt(now);
  }

  followingAt(now: Date): number | null {
    const from = now.getTime();
    const next = this.#occurrencesAfter(from, 1);
    return next[0] ?? null;
  }

  continuedAt(now: Date): number | null {
    const spec = this.#spec;

    if (spec.kind !== ScheduleKind.After) return null;

    return now.getTime() + spec.delay;
  }

  passedSlots(since: number, until: number): PassedSlots {
    const passed = this.#passedBetween(since, until);
    const first = passed[0];
    const last = passed.at(-1);

    if (first === undefined || last === undefined)
      return { from: since, to: since, count: 0 };

    const following = this.#occurrencesAfter(last, 1);
    const to = following[0] ?? until;
    return { from: first, to, count: passed.length };
  }

  upcoming(after: number, until: number, count: number): number[] {
    const next = this.#occurrencesAfter(after, count);
    return next.filter((at) => at <= until);
  }

  #passedBetween(since: number, until: number): number[] {
    const most = Schedule.#MOST_COUNTED;
    const earliest = this.#occurrencesAfter(since, most);
    const first = earliest[0];
    const last = earliest.at(-1);

    if (first === undefined || last === undefined) return [];

    const reached = last >= until;
    const ended = earliest.length < most;

    if (reached || ended) return earliest.filter((at) => at <= until);

    const span = last - first;
    const before = until - span - 1;
    const latest = this.#occurrencesAfter(before, most);
    return latest.filter((at) => at <= until);
  }

  #occurrencesAfter(from: number, count: number): number[] {
    const spec = this.#spec;

    switch (spec.kind) {
      case ScheduleKind.Every:
        return Schedule.#everyAfter(spec.interval, from, count);
      case ScheduleKind.Cron:
        return this.#cronAfter(from, count);
      case ScheduleKind.After:
      case ScheduleKind.On:
        return [];
    }
  }

  #cronAfter(from: number, count: number): number[] {
    const cron = this.#cron;

    if (cron === null) return [];

    return Schedule.#cronSlots(cron, from, count);
  }

  static #cronSlots(cron: CronTime, from: number, count: number): number[] {
    if (count === 0) return [];

    const start = new Date(from);
    const next = cron.getNextDateFrom(start, Schedule.#ZONE).toMillis();
    const later = Schedule.#cronSlots(cron, next, count - 1);
    return [next].concat(later);
  }

  static #everyAfter(interval: number, from: number, count: number): number[] {
    const passed = Math.floor(from / interval);
    const first = (passed + 1) * interval;
    return Array.from({ length: count }, (_, index) => {
      const slot = first + index * interval;
      return slot;
    });
  }

  static #cronOf(spec: ScheduleSpec): CronTime | null {
    if (spec.kind !== ScheduleKind.Cron) return null;

    return new CronTime(spec.cron, Schedule.#ZONE);
  }

  static #problemOf(spec: ScheduleSpec): string | null {
    if (spec.kind !== ScheduleKind.Cron) return null;

    const checked = validateCronExpression(spec.cron);

    if (!checked.valid) return checked.error?.message ?? spec.cron;

    return Schedule.#neverMatchedOf(spec.cron);
  }

  static #neverMatchedOf(expression: string): string | null {
    try {
      const cron = new CronTime(expression, Schedule.#ZONE);
      cron.getNextDateFrom(Schedule.#REFERENCE, Schedule.#ZONE);
      return null;
    } catch (error) {
      if (!(error instanceof Error)) throw error;

      return `The cron expression '${expression}' never matches`;
    }
  }
}
