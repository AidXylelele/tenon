import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  hostProfile,
  secrets,
  versionDocument,
  versionSource,
  webhooks,
  workflow,
} from "@/libs/data-access/automation";
import { draft } from "@/libs/data-access/drafts";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { workflowHref } from "@/libs/routing/routes";
import { type Query, segment } from "@/libs/routing/segment";
import { type Named, TrailName } from "@/libs/routing/trail-name";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import type { WorkflowParams } from "../../__shared_context/workflow-params";
import { Editor } from "./editor";
import type { Opening, Starts } from "./interfaces";
import { EditorQuery } from "./query";
import { editorTitle } from "./titles";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export function editorMetadata(params: WorkflowParams): Metadata {
  const name = segment(params.name);
  return { title: editorTitle(name) };
}

export async function WorkflowEditor({
  params,
  query = {},
}: {
  readonly params?: WorkflowParams;
  readonly query?: Query;
}) {
  const namespace =
    params === undefined ? undefined : segment(params.namespace);
  const name = params === undefined ? undefined : segment(params.name);
  const task = EditorQuery.parse(query).task ?? null;
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <div className="p-6">
        <EmptyState
          title="Viewers read workflows"
          description="Ask an administrator for the editor role to build and publish."
        />
      </div>
    );

  const read = await available(
    Promise.all([
      hostProfile(),
      secrets(),
      webhooks(),
      openingOf(namespace, name),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [profile, owned, hooks, opened] = read;
  const secretNames = owned.map((secret) => secret.name);
  const known = hooks.map((hook) => ({
    name: hook.name,
    eventType: hook.eventType,
  }));

  return (
    <>
      {opened.trail !== null && <TrailName {...opened.trail} />}
      <Editor
        opening={opened.opening}
        profile={profile}
        secretNames={secretNames}
        webhooks={known}
        starts={opened.starts}
        task={task}
        userId={session.user.id}
      />
    </>
  );
}

interface Opened {
  readonly opening: Opening;
  readonly starts: Starts | null;
  readonly trail: Named | null;
}

async function openingOf(
  namespace: string | undefined,
  name: string | undefined,
): Promise<Opened> {
  if (namespace === undefined || name === undefined)
    return { opening: { kind: "new" }, starts: null, trail: null };

  const named = { namespace, name };
  const [saved, found] = await Promise.all([
    draft(namespace, name),
    workflow(namespace, name),
  ]);
  const currentVersion = found?.currentVersion ?? null;
  const starts =
    found === null || currentVersion === null ? null : { on: found.on };
  const href = workflowHref(namespace, name);
  const label = found?.title ?? name;
  const trail = { href, label };

  if (saved !== null) {
    const opening: Opening = {
      kind: "draft",
      workflow: named,
      revision: saved,
      currentVersion,
    };
    return { opening, starts, trail };
  }

  if (currentVersion === null) notFound();

  const source = await versionSource(namespace, name, currentVersion);
  const document =
    source === null
      ? await versionDocument(namespace, name, currentVersion)
      : null;

  if (source === null && document === null) notFound();

  const opening: Opening = {
    kind: "version",
    workflow: named,
    version: currentVersion,
    source,
    document,
  };
  return { opening, starts, trail };
}
