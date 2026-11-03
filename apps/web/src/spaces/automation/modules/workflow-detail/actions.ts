'use server';

import { refresh } from 'next/cache';
import {
  archiveWorkflow,
  startInstance,
  turnWorkflow,
} from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';
import type { InstanceSummary, JsonValue } from '@/libs/data-access/types';

export async function startAction(
  namespace: string,
  name: string,
  version: string,
  input: JsonValue,
  idempotencyKey: string,
): Promise<Outcome<InstanceSummary>> {
  return startInstance(namespace, name, version, input, idempotencyKey);
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

export async function archiveAction(
  namespace: string,
  name: string,
): Promise<Outcome<void>> {
  const outcome = await archiveWorkflow(namespace, name);
  refresh();
  return outcome;
}
