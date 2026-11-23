import "server-only";
import { instance, taskRecords } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { segment } from "@/libs/routing/segment";
import { RunId } from "./form";
import type { TestRunParams } from "./interfaces";

const PRIVATE = { "cache-control": "private, no-store" };

export async function testRunProgress(
  params: TestRunParams,
): Promise<Response> {
  const parsed = RunId.safeParse(segment(params.run));

  if (!parsed.success) return emptyAnswer(404);

  try {
    return await progressOf(parsed.data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return emptyAnswer(503);
  }
}

async function progressOf(id: string): Promise<Response> {
  const [run, records] = await Promise.all([instance(id), taskRecords(id)]);

  if (run === null) return emptyAnswer(404);

  const test = { run, records: records.items };
  return Response.json(test, { headers: PRIVATE });
}

function emptyAnswer(status: number): Response {
  return new Response(null, { status, headers: PRIVATE });
}
