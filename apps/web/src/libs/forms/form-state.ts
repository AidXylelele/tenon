import type { z } from "zod";
import type { Problem } from "@/libs/data-access/problem";

export interface FormState {
  readonly problem: Problem | null;
  readonly done: boolean;
  readonly values: Record<string, string>;
}

export const IDLE: FormState = { problem: null, done: false, values: {} };

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function refusalOf(error: z.ZodError): FormState {
  const errors = error.issues.map((issue) => {
    const pointer = `/${issue.path.join("/")}`;
    return { pointer, detail: issue.message, line: null, column: null };
  });
  const problem: Problem = {
    type: "about:blank",
    title: "Check the form",
    status: 400,
    detail: "A field was not filled in as the form expects.",
    errors,
    retryAfter: null,
  };
  return { problem, done: false, values: {} };
}
