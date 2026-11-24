import { notFound } from "next/navigation";
import { z } from "zod";

export function segment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    notFound();
  }
}

export type Query = Record<string, string | string[] | undefined>;

export const queryText = z.string().min(1).optional().catch(undefined);
