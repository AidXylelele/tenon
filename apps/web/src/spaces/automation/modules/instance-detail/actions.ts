'use server';

import { refresh } from 'next/cache';
import {
  controlInstance,
  deleteInstance,
  type InstanceControl,
  restartInstance,
} from '@/libs/data-access/automation';
import type { Outcome } from '@/libs/data-access/problem';
import type { InstanceSummary } from '@/libs/data-access/types';

export async function controlAction(
  id: string,
  control: InstanceControl,
): Promise<Outcome<void>> {
  const outcome = await controlInstance(id, control);
  refresh();
  return outcome;
}

export async function restartAction(
  id: string,
): Promise<Outcome<InstanceSummary>> {
  return restartInstance(id);
}

export async function deleteAction(id: string): Promise<Outcome<void>> {
  return deleteInstance(id);
}
