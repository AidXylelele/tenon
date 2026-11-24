import { isCron } from "../../runtime/index.js";
import type { CronSchedule, Finding, Schedule } from "../../syntax/index.js";
import type { CheckSubject } from "./types.js";

const none: readonly Finding[] = [];

export function checkCron(subject: CheckSubject): readonly Finding[] {
  return subject.workflow.schedules.flatMap(cronFindingsOf);
}

function cronFindingsOf(schedule: Schedule): readonly Finding[] {
  switch (schedule.kind) {
    case "cron":
      return invalidCronsOf(schedule);
    case "every":
    case "after":
    case "on":
      return none;
  }
}

function invalidCronsOf(schedule: CronSchedule): readonly Finding[] {
  const isValid = isCron(schedule.cron);

  if (isValid) {
    return none;
  }

  const finding: Finding<"invalidCron"> = {
    name: "invalidCron",
    code: "cron",
    pointer: schedule.pointer,
    subject: null,
    details: [schedule.cron],
    import: null,
  };
  return [finding];
}
