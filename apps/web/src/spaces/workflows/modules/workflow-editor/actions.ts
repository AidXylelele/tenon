"use server";

import { checkDocument, fetchImport } from "@/libs/data-access/automation";
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
  ImportAddress,
  PublishedDocument,
} from "./form";

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

export async function checkAction(document: unknown): Promise<Outcome<void>> {
  const parsed = PublishedDocument.safeParse(document);

  if (!parsed.success) return { ok: false, problem: UNREADABLE };

  return checkDocument(parsed.data);
}

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
