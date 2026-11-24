import type { Manifest, Schedule } from "../../api/index.js";
import type { Procedure, Program, Stream } from "../forms/index.js";
import { groupOf, leafOf, lineOf, type Line } from "./line.js";
import { termLineOf } from "./terms.js";
import { millisecondsText } from "./values.js";

export type PrintedProgram = Pick<
  Program,
  "root" | "procedures" | "triggers" | "manifest"
>;

export function programLinesOf(program: PrintedProgram): readonly Line[] {
  const body = termLineOf(program.root);
  const root = groupOf("root", [body]);
  const procedureValues = program.procedures.values();
  const procedures = Array.from(procedureValues, procedureLineOf);
  const triggers = program.triggers.map(triggerLineOf);
  const manifest = manifestLineOf(program.manifest);

  return [root, ...procedures, ...triggers, manifest];
}

function procedureLineOf(procedure: Procedure): Line {
  const body = termLineOf(procedure.body);
  return lineOf(`procedure ${procedure.key}`, [body]);
}

function triggerLineOf(trigger: Stream, index: number): Line {
  const stream = termLineOf(trigger);
  const label = `trigger ${String(index)}`;

  return lineOf(label, [stream]);
}

function manifestLineOf(manifest: Manifest): Line {
  const effectsText = listText("effects", manifest.effects);
  const secretsText = listText("secrets", manifest.secrets);
  const effects = leafOf(effectsText);
  const secrets = leafOf(secretsText);
  const schedules = manifest.schedules.map(scheduleLineOf);
  const children = [effects, secrets, ...schedules];

  return groupOf("manifest", children);
}

function listText(label: string, names: readonly string[]): string {
  return [label, ...names].join(" ");
}

function scheduleLineOf(schedule: Schedule): Line {
  switch (schedule.kind) {
    case "every": {
      const interval = millisecondsText(schedule.interval);
      return leafOf(`schedule every ${interval}`);
    }
    case "cron":
      return leafOf(`schedule cron ${schedule.cron}`);
    case "after": {
      const delay = millisecondsText(schedule.delay);
      return leafOf(`schedule after ${delay}`);
    }
    case "on":
      return leafOf(`schedule on ${schedule.stream}`);
  }
}
