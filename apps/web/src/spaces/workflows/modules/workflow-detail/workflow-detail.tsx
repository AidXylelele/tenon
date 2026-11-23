import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  instanceCounts,
  instances,
  versionStructure,
  versions as versionsOf,
  workflow as workflowOf,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { type Query, segment } from "@/libs/routing/segment";
import { ViewerZone } from "@/libs/live/viewer-zone";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { countWindowOf, windowsOf } from "@/operations/run-periods";
import type { WorkflowParams } from "../../__shared_context/workflow-params";
import { WorkflowQuery } from "./query";
import { WorkflowPage } from "./workflow-page";

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
  const period = address.period;
  const zone = await viewerZone();
  const now = new Date().toISOString();
  const windows = windowsOf(period, now, zone);
  const window = { ...countWindowOf(windows), namespace, name };
  const read = await available(
    Promise.all([
      currentSession(),
      workflowOf(namespace, name),
      versionsOf(namespace, name),
      instances({ namespace, name, limit }),
      instanceCounts(window),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, workflow, versions, runs, counts] = read;

  if (workflow === null) notFound();

  const current = workflow.currentVersion;
  const reading =
    current === null ? null : versionStructure(namespace, name, current);
  const structure = await available(Promise.resolve(reading));

  if (structure === UNAVAILABLE) return <Unavailable />;

  const newestFirst = versions.slice().reverse();
  const author = session?.capabilities.author === true;
  const operator = session?.capabilities.operator === true;

  return (
    <>
      <ViewerZone zone={zone} />
      <WorkflowPage
        workflow={workflow}
        tab={tab}
        versions={newestFirst}
        runs={runs}
        structure={structure}
        author={author}
        operator={operator}
        period={period}
        zone={zone}
        windows={windows}
        counts={counts}
      />
    </>
  );
}
