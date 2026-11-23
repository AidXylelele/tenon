"use server";

import {
  fetchImport,
  instance,
  versionSource,
  versionStructure,
  publishEvent,
  taskRecords,
  turnWorkflow,
} from "@/libs/data-access/automation";
import {
  checkDraft,
  draft,
  publishDraft,
  writeDraft,
} from "@/libs/data-access/drafts";
import type { Outcome, Problem } from "@/libs/data-access/problem";
import type {
  DraftCheck,
  DraftPublication,
  DraftRevision,
  DraftWrite,
} from "@/libs/data-access/types";
import {
  DraftEtag,
  DraftSave,
  DraftStart,
  DraftTarget,
  DraftTest,
  ImportAddress,
  RunId,
  StartsTurn,
  TestEventType,
  VersionTarget,
} from "./form";
import type { StepList } from "language-server/protocol";
import type { TestRun, TestRunAnswer } from "./interfaces";
import { testDraft } from "./test-runs";

const UNREADABLE: Problem = {
  type: "about:blank",
  title: "The request is not readable",
  status: 400,
  detail:
    "Only a workflow's draft and document can be saved, checked or published.",
  errors: [],
  retryAfter: null,
};

const REFUSED = { kind: "refused", problem: UNREADABLE } as const;

const UNFETCHABLE: Problem = {
  type: "about:blank",
  title: "The address is not fetchable",
  status: 400,
  detail:
    "Only an http or https address of at most 2,048 characters is fetched.",
  errors: [],
  retryAfter: null,
};

export async function fetchImportAction(
  address: unknown,
): Promise<Outcome<string>> {
  const parsed = ImportAddress.safeParse(address);

  if (!parsed.success) return { ok: false, problem: UNFETCHABLE };

  const fetched = await fetchImport(parsed.data);

  if (!fetched.ok) return fetched;

  return { ok: true, value: fetched.value.text };
}

export async function saveDraftAction(request: unknown): Promise<DraftWrite> {
  const parsed = DraftSave.safeParse(request);

  if (!parsed.success) return REFUSED;

  const { namespace, name, source, layout, etag } = parsed.data;
  return writeDraft(namespace, name, { source, layout }, etag);
}

export async function startDraftAction(request: unknown): Promise<DraftWrite> {
  const parsed = DraftStart.safeParse(request);

  if (!parsed.success) return REFUSED;

  const { namespace, name, source } = parsed.data;
  return writeDraft(namespace, name, { source, layout: {} }, null);
}

export async function readDraftAction(
  request: unknown,
): Promise<DraftRevision | null> {
  const parsed = DraftTarget.safeParse(request);

  if (!parsed.success) return null;

  return draft(parsed.data.namespace, parsed.data.name);
}

export async function checkDraftAction(request: unknown): Promise<DraftCheck> {
  const parsed = DraftEtag.safeParse(request);

  if (!parsed.success) return { kind: "unchanged" };

  const { namespace, name, etag } = parsed.data;
  return checkDraft(namespace, name, etag);
}

export async function publishDraftAction(
  request: unknown,
): Promise<DraftPublication> {
  const parsed = DraftEtag.safeParse(request);

  if (!parsed.success) return REFUSED;

  const { namespace, name, etag } = parsed.data;
  return publishDraft(namespace, name, etag);
}

export async function testRunAction(request: unknown): Promise<TestRunAnswer> {
  const parsed = DraftTest.safeParse(request);

  if (!parsed.success) return REFUSED;

  const { namespace, name, etag, input } = parsed.data;
  const key = crypto.randomUUID();
  return testDraft(namespace, name, etag, input, key);
}

export async function testRunReadAction(id: unknown): Promise<TestRun | null> {
  const parsed = RunId.safeParse(id);

  if (!parsed.success) return null;

  const [run, records] = await Promise.all([
    instance(parsed.data),
    taskRecords(parsed.data),
  ]);

  if (run === null) return null;

  return { run, records: records.items };
}

export async function turnStartsAction(
  request: unknown,
): Promise<Outcome<void>> {
  const parsed = StartsTurn.safeParse(request);

  if (!parsed.success) return { ok: false, problem: UNREADABLE };

  const { namespace, name, on } = parsed.data;
  return turnWorkflow(namespace, name, on);
}

export async function testEventAction(type: unknown): Promise<Outcome<void>> {
  const parsed = TestEventType.safeParse(type);

  if (!parsed.success) return { ok: false, problem: UNREADABLE };

  const id = crypto.randomUUID();
  const time = new Date().toISOString();
  const event = {
    specversion: "1.0",
    id,
    source: "tenon/console",
    type: parsed.data,
    time,
    data: {},
  };
  return publishEvent(event);
}

export async function versionStepsAction(
  request: unknown,
): Promise<StepList | null> {
  const parsed = VersionTarget.safeParse(request);

  if (!parsed.success) return null;

  const { namespace, name, version } = parsed.data;
  const structure = await versionStructure(namespace, name, version);
  return structure?.steps ?? null;
}

export async function versionSourceAction(
  request: unknown,
): Promise<string | null> {
  const parsed = VersionTarget.safeParse(request);

  if (!parsed.success) return null;

  const { namespace, name, version } = parsed.data;
  return versionSource(namespace, name, version);
}
