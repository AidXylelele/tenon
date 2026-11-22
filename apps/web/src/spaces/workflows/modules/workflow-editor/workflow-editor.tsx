import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  hostProfile,
  secrets,
  versionDocument,
  versionSource,
  workflow,
} from "@/libs/data-access/automation";
import { draft } from "@/libs/data-access/drafts";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { type Query, segment } from "@/libs/routing/segment";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import type { WorkflowParams } from "../../__shared_context/workflow-params";
import { Editor } from "./editor";
import type { Opening } from "./interfaces";
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
    Promise.all([hostProfile(), secrets(), openingOf(namespace, name)]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [profile, owned, opening] = read;
  const secretNames = owned.map((secret) => secret.name);

  return (
    <Editor
      opening={opening}
      profile={profile}
      secretNames={secretNames}
      task={task}
      userId={session.user.id}
    />
  );
}

async function openingOf(
  namespace: string | undefined,
  name: string | undefined,
): Promise<Opening> {
  if (namespace === undefined || name === undefined) return { kind: "new" };

  const named = { namespace, name };
  const [saved, found] = await Promise.all([
    draft(namespace, name),
    workflow(namespace, name),
  ]);
  const currentVersion = found?.currentVersion ?? null;

  if (saved !== null)
    return {
      kind: "draft",
      workflow: named,
      revision: saved,
      currentVersion,
    };

  if (currentVersion === null) notFound();

  const source = await versionSource(namespace, name, currentVersion);
  const document =
    source === null
      ? await versionDocument(namespace, name, currentVersion)
      : null;

  if (source === null && document === null) notFound();

  return {
    kind: "version",
    workflow: named,
    version: currentVersion,
    source,
    document,
  };
}
