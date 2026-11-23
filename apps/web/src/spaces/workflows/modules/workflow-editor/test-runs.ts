import "server-only";
import { ApiError, problemOfResponse, send } from "@/libs/data-access/http";
import { unreachable } from "@/libs/data-access/problem";
import type { InstanceSummary } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
import type { TestRunAnswer } from "./interfaces";

const PRECONDITION_FAILED = 412;

export async function testDraft(
  namespace: string,
  name: string,
  etag: string,
  input: JsonValue,
  idempotencyKey: string,
): Promise<TestRunAnswer> {
  const workflow = `${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  const path = `/workflows/${workflow}/draft/test-runs`;
  const headers = { "if-match": etag, "idempotency-key": idempotencyKey };
  const options = { method: "POST" as const, json: { input }, headers };
  let response: Response;

  try {
    response = await send(path, options);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    const problem = unreachable(error.message);
    return { kind: "refused", problem };
  }

  if (response.status === PRECONDITION_FAILED) return { kind: "conflict" };

  if (!response.ok) {
    const problem = await problemOfResponse(response);
    return { kind: "refused", problem };
  }

  const run: InstanceSummary = await response.json();
  return { kind: "started", run };
}
