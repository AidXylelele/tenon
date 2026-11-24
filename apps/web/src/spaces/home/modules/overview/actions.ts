"use server";

import { refresh } from "next/cache";
import { controlInstance, turnWorkflow } from "@/libs/data-access/automation";
import type { Outcome } from "@/libs/data-access/problem";

export async function resumeAction(id: string): Promise<Outcome<void>> {
  const outcome = await controlInstance(id, "resume");
  refresh();
  return outcome;
}

export async function turnAction(
  namespace: string,
  name: string,
  on: boolean,
): Promise<Outcome<void>> {
  const outcome = await turnWorkflow(namespace, name, on);
  refresh();
  return outcome;
}
