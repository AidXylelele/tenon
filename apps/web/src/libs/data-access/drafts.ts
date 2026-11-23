import "server-only";
import {
  ApiError,
  bodyOfResponse,
  problemOfResponse,
  type RequestOptions,
  send,
} from "./http";
import { unreachable } from "./problem";
import { DraftConflictBody } from "./draft-conflict";
import type {
  Draft,
  DraftAnswer,
  DraftCheck,
  DraftContent,
  DraftPublication,
  DraftRefusal,
  DraftRevision,
  DraftTestRun,
  DraftWrite,
  InstanceSummary,
  Version,
} from "./types";
import type { JsonValue } from "@/libs/json/json";

const NOT_MODIFIED = 304;
const NOT_FOUND = 404;
const PRECONDITION_FAILED = 412;

export async function draft(
  namespace: string,
  name: string,
): Promise<DraftRevision | null> {
  const response = await send(draftPath(namespace, name));

  if (response.status === NOT_FOUND) return null;

  if (!response.ok) throw await failureOf(response);

  return revisionOf(response);
}

export async function checkDraft(
  namespace: string,
  name: string,
  etag: string,
): Promise<DraftCheck> {
  const headers = { "if-none-match": etag };
  const response = await send(draftPath(namespace, name), { headers });

  if (response.status === NOT_MODIFIED) return { kind: "unchanged" };

  if (response.status === NOT_FOUND) return { kind: "missing" };

  if (!response.ok) throw await failureOf(response);

  const revision = await revisionOf(response);
  return { kind: "changed", revision };
}

export async function writeDraft(
  namespace: string,
  name: string,
  content: DraftContent,
  etag: string | null,
): Promise<DraftWrite> {
  const precondition = etag === null ? "if-none-match" : "if-match";
  const headers = { [precondition]: etag ?? "*" };
  const options = { method: "PUT" as const, json: content, headers };
  const answer = await answerOf(draftPath(namespace, name), options);

  if (answer.kind === "refused") return answer;

  const response = answer.response;

  if (!response.ok) return refusalOf(response);

  const revision = await revisionOf(response);
  return { kind: "saved", revision };
}

export async function publishDraft(
  namespace: string,
  name: string,
  etag: string,
): Promise<DraftPublication> {
  const headers = { "if-match": etag };
  const options = { method: "POST" as const, headers };
  const answer = await answerOf(draftPath(namespace, name), options);

  if (answer.kind === "refused") return answer;

  const response = answer.response;

  if (!response.ok) return refusalOf(response);

  const version: Version = await response.json();
  return { kind: "published", version };
}

export async function testDraft(
  namespace: string,
  name: string,
  etag: string,
  input: JsonValue,
  idempotencyKey: string,
): Promise<DraftTestRun> {
  const headers = { "if-match": etag, "idempotency-key": idempotencyKey };
  const options = { method: "POST" as const, json: { input }, headers };
  const path = `${draftPath(namespace, name)}/test-runs`;
  const answer = await answerOf(path, options);

  if (answer.kind === "refused") return answer;

  const response = answer.response;

  if (!response.ok) return refusalOf(response);

  const run: InstanceSummary = await response.json();
  return { kind: "started", run };
}

function draftPath(namespace: string, name: string): string {
  const workflow = `${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
  return `/workflows/${workflow}/draft`;
}

async function answerOf(
  path: string,
  options: RequestOptions,
): Promise<DraftAnswer> {
  try {
    const response = await send(path, options);
    return { kind: "answered", response };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    const problem = unreachable(error.message);
    return { kind: "refused", problem };
  }
}

async function revisionOf(response: Response): Promise<DraftRevision> {
  const etag = response.headers.get("etag") ?? "";
  const draft: Draft = await response.json();
  return { draft, etag };
}

async function refusalOf(response: Response): Promise<DraftRefusal> {
  if (response.status === PRECONDITION_FAILED) {
    const body = await bodyOfResponse(response);
    const current = currentOf(body, response.headers.get("etag"));
    return { kind: "conflict", current };
  }

  const problem = await problemOfResponse(response);
  return { kind: "refused", problem };
}

function currentOf(body: unknown, etag: string | null): DraftRevision | null {
  const parsed = DraftConflictBody.safeParse(body);
  const draft = parsed.success ? parsed.data.current : undefined;

  if (draft === undefined || etag === null) return null;

  return { draft, etag };
}

async function failureOf(response: Response): Promise<ApiError> {
  const problem = await problemOfResponse(response);
  return new ApiError(response.status, problem.detail);
}
