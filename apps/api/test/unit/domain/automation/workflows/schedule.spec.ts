import { ScheduleKind } from "../../../../../src/domain/automation/workflows/enums.js";
import { Schedule } from "../../../../../src/domain/automation/workflows/schedule.js";

const MINUTE = 60_000;
const at = (iso: string): number => Date.parse(iso);

describe("a schedule", () => {
  it("a_cron_schedule_is_due_at_its_next_utc_slot_strictly_after_now", () => {
    const schedule = new Schedule({
      kind: ScheduleKind.Cron,
      cron: "0 9 * * *",
    });
    const nine = new Date("2026-01-01T09:00:00.000Z");
    const before = new Date("2026-01-01T08:59:59.999Z");

    expect(schedule.followingAt(nine)).toBe(at("2026-01-02T09:00:00.000Z"));
    expect(schedule.followingAt(before)).toBe(at("2026-01-01T09:00:00.000Z"));
  });

  it("an_every_schedule_repeats_its_interval_from_the_epoch", () => {
    const schedule = new Schedule({
      kind: ScheduleKind.Every,
      interval: 15 * MINUTE,
    });
    const from = at("2026-01-01T10:07:00.000Z");

    const slots = schedule.occurrencesAfter(from, 3);

    expect(slots).toEqual([
      at("2026-01-01T10:15:00.000Z"),
      at("2026-01-01T10:30:00.000Z"),
      at("2026-01-01T10:45:00.000Z"),
    ]);
  });

  it("an_after_schedule_is_armed_at_once_and_continues_after_its_delay", () => {
    const schedule = new Schedule({ kind: ScheduleKind.After, delay: MINUTE });
    const now = new Date("2026-01-01T10:00:00.000Z");

    expect(schedule.armedAt(now)).toBe(now.getTime());
    expect(schedule.followingAt(now)).toBeNull();
    expect(schedule.continuedAt(now)).toBe(now.getTime() + MINUTE);
    expect(schedule.chained).toBe(true);
  });

  it("an_event_schedule_is_never_armed", () => {
    const schedule = new Schedule({
      kind: ScheduleKind.On,
      stream: "orders",
      types: [],
    });
    const now = new Date("2026-01-01T10:00:00.000Z");

    expect(schedule.armedAt(now)).toBeNull();
    expect(schedule.continuedAt(now)).toBeNull();
  });

  it("a_cron_expression_out_of_range_is_refused_with_its_reason", () => {
    const refused = Schedule.of({
      kind: ScheduleKind.Cron,
      cron: "61 * * * *",
    });

    expect(refused).toEqual({
      ok: false,
      failure: "Field value (61) is out of range",
    });
  });

  it("a_cron_expression_that_never_matches_is_refused", () => {
    const refused = Schedule.of({
      kind: ScheduleKind.Cron,
      cron: "0 0 30 2 *",
    });

    expect(refused).toEqual({
      ok: false,
      failure: "The cron expression '0 0 30 2 *' never matches",
    });
  });

  it("a_valid_cron_expression_is_accepted", () => {
    const accepted = Schedule.of({
      kind: ScheduleKind.Cron,
      cron: "0 9 * * MON-FRI",
    });

    expect(accepted.ok).toBe(true);
  });
});
