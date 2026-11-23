"use server";

import { refresh } from "next/cache";
import { archiveWorkflow, turnWorkflow } from "@/libs/data-access/automation";
import type { Outcome } from "@/libs/data-access/problem";

export async function turnAction(
  namespace: string,
  name: string,
  on: boolean,
): Promise<Outcome<void>> {
  const outcome = await turnWorkflow(namespace, name, on);
  refresh();
  return outcome;
}

export async function archiveAction(
  namespace: string,
  name: string,
): Promise<Outcome<void>> {
  const outcome = await archiveWorkflow(namespace, name);
  refresh();
  return outcome;
}
