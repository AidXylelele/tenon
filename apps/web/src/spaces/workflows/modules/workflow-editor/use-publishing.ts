"use client";

import type { LSPClient } from "@codemirror/lsp-client";
import type { EditAction, StepList } from "language-server/protocol";
import type { Outcome, Problem } from "@/libs/data-access/problem";
import type { Version } from "@/libs/data-access/types";
import { turnStartsAction } from "./actions";
import { changesOf } from "./changes";
import type { DraftStore } from "./draft-store";
import { useDraftState } from "./draft-views";
import type { ChangeReading, WorkflowName } from "./interfaces";
import { publishedStepsOf, publishedTextOf } from "./reads";
import { nextVersion, versionEdit } from "./version";
import { yamlOf } from "./yaml-text";

interface PublishingProps {
  readonly client: LSPClient;
  readonly name: WorkflowName;
  readonly currentVersion: string | null;
  readonly steps: StepList | null;
  readonly store: DraftStore;
  readonly edit: (
    actions: readonly EditAction[],
    remembered?: boolean,
  ) => Promise<boolean>;
}

const NOT_DISCARDED: Problem = {
  type: "about:blank",
  title: "The published version could not be read",
  status: 503,
  detail: "The published version's text could not be read, so the draft stays.",
  errors: [],
  retryAfter: null,
};

const HELD: Problem = {
  type: "about:blank",
  title: "Someone else saved this draft meanwhile",
  status: 412,
  detail: "Resolve the draft first, then discard it.",
  errors: [],
  retryAfter: null,
};

const NO_CHANGES: ChangeReading = { kind: "read", changes: [] };

const UNREAD: ChangeReading = { kind: "unread" };

export function usePublishing({
  client,
  name,
  currentVersion,
  steps,
  store,
  edit,
}: PublishingProps) {
  const draft = useDraftState(store);
  const hasDraft = currentVersion !== null && draft.saved !== null;

  async function changesSincePublished(): Promise<ChangeReading> {
    if (currentVersion === null || steps === null) return NO_CHANGES;

    try {
      const published = await publishedStepsOf(name, currentVersion);
      const changes = changesOf(published, steps);
      return { kind: "read", changes };
    } catch {
      return UNREAD;
    }
  }

  async function setVersion(value: string): Promise<void> {
    const change = versionEdit(value);
    await edit([change]);
  }

  async function afterPublishing(version: Version): Promise<void> {
    const next = nextVersion(version.version);
    const change = versionEdit(next);
    await edit([change], false);
    await store.flush();
  }

  function turnOn(): Promise<Outcome<void>> {
    const request = { ...name, on: true };
    return turnStartsAction(request);
  }

  async function discard(): Promise<Outcome<void>> {
    const text = await publishedText();

    if (text === null) return { ok: false, problem: NOT_DISCARDED };

    const answer = await store.discard(text);

    if (answer.kind === "held") return { ok: false, problem: HELD };

    if (answer.kind === "refused")
      return { ok: false, problem: answer.problem };

    return { ok: true, value: undefined };
  }

  async function publishedText(): Promise<string | null> {
    if (currentVersion === null) return null;

    try {
      const published = await publishedTextOf(name, currentVersion);
      return await yamlOf(client, published);
    } catch {
      return null;
    }
  }

  return {
    publish: () => store.publish(),
    changesSincePublished,
    setVersion,
    afterPublishing,
    turnOn,
    discard: hasDraft ? discard : null,
  };
}
