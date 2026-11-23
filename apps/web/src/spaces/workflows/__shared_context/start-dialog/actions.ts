"use server";

import { startInstance } from "@/libs/data-access/automation";
import type { Outcome } from "@/libs/data-access/problem";
import type { InstanceSummary } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";

export async function startAction(
  namespace: string,
  name: string,
  version: string,
  input: JsonValue,
  idempotencyKey: string,
): Promise<Outcome<InstanceSummary>> {
  return startInstance(namespace, name, version, input, idempotencyKey);
}
