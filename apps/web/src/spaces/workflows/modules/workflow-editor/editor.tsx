"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftRevision, HostProfile } from "@/libs/data-access/types";
import { DiagnosticsBoard } from "@/libs/language-client/diagnostics-board";
import { reasonOf } from "@/libs/language-client/failures";
import type { LanguageConnection } from "@/libs/language-client/interfaces";
import { useLanguageConnection } from "@/libs/language-client/use-language-connection";
import { pageTitle } from "@/libs/routing/page-title";
import { editorHref } from "@/libs/routing/routes";
import { Spinner } from "@/libs/ui/components/spinner";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import {
  fetchingImports,
  startWorkflowLanguage,
  textFromJson,
} from "@/operations/workflow-language";
import { fetchImportAction, startDraftAction } from "./actions";
import { LANGUAGE_FEATURES } from "./code-view";
import { EditingPage } from "./editing-page";
import type { EditorProps, Opening, WorkflowName } from "./interfaces";
import { NamingDialog } from "./naming-dialog";
import { editorTitle } from "./titles";

interface Opened {
  readonly name: WorkflowName;
  readonly text: string;
  readonly bumpFrom: string | null;
  readonly revision: DraftRevision | null;
  readonly currentVersion: string | null;
}

export function Editor({
  opening,
  profile,
  secretNames,
  webhooks,
  starts,
  task,
  userId,
}: EditorProps) {
  const [board] = useState(() => new DiagnosticsBoard());
  const state = useLanguageConnection(() =>
    startWorkflowLanguage({
      initializationOptions: initializationOptionsOf(
        profile,
        secretNames,
        addressOf(opening),
      ),
      extensions: LANGUAGE_FEATURES,
      notificationHandlers: {
        "textDocument/publishDiagnostics": board.receive,
        ...fetchingImports(fetchImportAction),
      },
    }),
  );

  if (state.kind === "starting")
    return (
      <p
        role="status"
        className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Spinner />
        Starting the language service…
      </p>
    );

  if (state.kind === "failed")
    return (
      <div className="p-6">
        <EmptyState
          title="The editor could not start"
          description={state.reason}
        />
      </div>
    );

  return (
    <Opener
      connection={state.connection}
      board={board}
      opening={opening}
      webhooks={webhooks}
      starts={starts}
      task={task}
      userId={userId}
    />
  );
}

function Opener({
  connection,
  board,
  opening,
  webhooks,
  starts,
  task,
  userId,
}: {
  readonly connection: LanguageConnection;
  readonly board: DiagnosticsBoard;
  readonly opening: Opening;
  readonly webhooks: EditorProps["webhooks"];
  readonly starts: EditorProps["starts"];
  readonly task: string | null;
  readonly userId: string;
}) {
  const client = connection.client;
  const [converted, setConverted] = useState<Opened | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const direct = useMemo(() => openedOf(opening), [opening]);
  const opened = direct ?? converted;

  useEffect(() => {
    if (opening.kind !== "version" || opening.document === null) return;

    let current = true;
    const bumpFrom = opening.version;
    textFromJson(client, opening.document).then(
      (answer) => {
        if (!current) return;

        const name = opening.workflow;
        const read = { name, text: answer.text, bumpFrom };
        setConverted({ ...read, revision: null, currentVersion: bumpFrom });
      },
      (reason: unknown) => {
        if (current) setFailure(reasonOf(reason));
      },
    );

    return () => {
      current = false;
    };
  }, [client, opening]);

  function openDraft(name: WorkflowName, revision: DraftRevision) {
    const text = revision.draft.source;
    const page = editorHref(name.namespace, name.name);
    setConverted({
      name,
      text,
      bumpFrom: null,
      revision,
      currentVersion: null,
    });
    window.history.replaceState(null, "", page);
    document.title = pageTitle(editorTitle(name.name));
  }

  if (failure !== null)
    return (
      <div className="p-6">
        <EmptyState
          title="The version could not be opened"
          description={failure}
        />
      </div>
    );

  if (opened === null)
    return opening.kind === "new" ? (
      <NamingDialog
        client={client}
        userId={userId}
        onNamed={startDraftAction}
        onOpen={openDraft}
      />
    ) : (
      <OpeningNote />
    );

  return (
    <EditingPage
      client={client}
      board={board}
      name={opened.name}
      text={opened.text}
      currentVersion={opened.currentVersion}
      revision={opened.revision}
      bumpFrom={opened.bumpFrom}
      task={task}
      userId={userId}
      webhooks={webhooks}
      starts={starts}
    />
  );
}

function OpeningNote() {
  return (
    <p
      role="status"
      className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner />
      Opening the workflow…
    </p>
  );
}

function openedOf(opening: Opening): Opened | null {
  if (opening.kind === "draft") {
    const revision = opening.revision;
    const text = revision.draft.source;
    const currentVersion = opening.currentVersion;
    return {
      name: opening.workflow,
      text,
      bumpFrom: null,
      revision,
      currentVersion,
    };
  }

  if (opening.kind === "version" && opening.source !== null) {
    const text = opening.source;
    const bumpFrom = opening.version;
    const name = opening.workflow;
    return { name, text, bumpFrom, revision: null, currentVersion: bumpFrom };
  }

  return null;
}

function initializationOptionsOf(
  profile: HostProfile,
  secretNames: readonly string[],
  draft: WorkflowName | null,
): unknown {
  return {
    profile: {
      effects: profile.effects,
      authentications: profile.authentications,
      processes: profile.processes,
      scriptLanguages: profile.scriptLanguages,
      asyncApiProtocols: profile.asyncApiProtocols,
      mcpTransports: profile.mcpTransports,
      mcpTransportOptions: profile.mcpTransportOptions,
      schedules: profile.schedules,
      triggers: profile.triggers,
      grants: profile.grants,
      secrets: secretNames,
    },
    draft: draft ?? undefined,
  };
}

function addressOf(opening: Opening): WorkflowName | null {
  return opening.kind === "new" ? null : opening.workflow;
}
