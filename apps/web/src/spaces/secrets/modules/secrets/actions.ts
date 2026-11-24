"use server";

import { refresh } from "next/cache";
import {
  createSecret,
  deleteSecret,
  replaceSecret,
} from "@/libs/data-access/automation";
import type { Outcome } from "@/libs/data-access/problem";
import type { Secret } from "@/libs/data-access/types";

export async function createSecretAction(
  name: string,
  value: string,
): Promise<Outcome<Secret>> {
  const outcome = await createSecret(name, value);
  refresh();
  return outcome;
}

export async function replaceSecretAction(
  name: string,
  value: string,
): Promise<Outcome<void>> {
  const outcome = await replaceSecret(name, value);
  refresh();
  return outcome;
}

export async function deleteSecretAction(name: string): Promise<Outcome<void>> {
  const outcome = await deleteSecret(name);
  refresh();
  return outcome;
}
