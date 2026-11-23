import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  instances,
  versionSource,
  versionStructure,
  versions as versionsOf,
  workflow as workflowOf,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { VersionStructure } from "@/libs/data-access/types";
import { type Query, segment } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import type { WorkflowParams } from "../../__shared_context/workflow-params";
import { yamlFileOf } from "../../__shared_context/yaml-file";
import { WorkflowQuery } from "./query";
import { WorkflowPage } from "./workflow-page";

const NOTHING_PUBLISHED = [null, null] as const;

const RECENT = 10;
const LISTED = 50;

export function workflowMetadata(params: WorkflowParams): Metadata {
  const name = segment(params.name);
  return { title: name };
}

export async function WorkflowDetail({
  params,
  query,
}: {
  readonly params: WorkflowParams;
  readonly query: Query;
}) {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const address = WorkflowQuery.parse(query);
  const tab = address.tab;
  const limit = tab === "runs" ? LISTED : RECENT;
  const read = await available(
    Promise.all([
      currentSession(),
      workflowOf(namespace, name),
      versionsOf(namespace, name),
      instances({ namespace, name, limit }),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, workflow, versions, runs] = read;

  if (workflow === null) notFound();

  const current = workflow.currentVersion;
  const reading: Promise<readonly [VersionStructure | null, string | null]> =
    current === null
      ? Promise.resolve(NOTHING_PUBLISHED)
      : Promise.all([
          versionStructure(namespace, name, current),
          versionSource(namespace, name, current),
        ]);
  const published = await available(reading);

  if (published === UNAVAILABLE) return <Unavailable />;

  const [structure, source] = published;
  const yaml = yamlFileOf(name, current, source);
  const newestFirst = versions.slice().reverse();
  const author = session?.capabilities.author === true;
  const operator = session?.capabilities.operator === true;

  return (
    <WorkflowPage
      workflow={workflow}
      tab={tab}
      versions={newestFirst}
      runs={runs}
      structure={structure}
      yaml={yaml}
      author={author}
      operator={operator}
      starting={address.start}
    />
  );
}
