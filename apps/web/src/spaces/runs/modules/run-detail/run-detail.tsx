import { notFound } from "next/navigation";
import {
  instance as instanceOf,
  hostProfile,
  instanceEvents,
  taskRecords,
  versionStructure,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { Instance } from "@/libs/data-access/types";
import { type Query, segment } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { isUnended } from "@/operations/run-progress";
import { type RunPanel, RunQuery } from "./query";
import { RunPage } from "./run-page";

interface RunDetailProps {
  readonly params: { readonly id: string };
  readonly query: Query;
}

export async function RunDetail({ params, query }: RunDetailProps) {
  const id = segment(params.id);
  const address = RunQuery.parse(query);
  const read = await available(
    Promise.all([currentSession(), instanceOf(id), taskRecords(id)]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, instance, records] = read;

  if (instance === null) notFound();

  const panel = address.view ?? defaultPanelOf(instance);
  const reading = panel === "events";
  const shown = await available(
    Promise.all([
      reading ? instanceEvents(id) : null,
      reading ? hostProfile() : null,
      versionStructure(instance.namespace, instance.name, instance.version),
    ]),
  );

  if (shown === UNAVAILABLE) return <Unavailable />;

  const [events, profile, workflow] = shown;
  const twins = new Set(
    (profile?.lifecycleEvents ?? []).flatMap((event) => event.types.slice(1)),
  );
  const author = session?.capabilities.author === true;
  const operator = session?.capabilities.operator === true;
  const eventItems =
    events?.items.filter((event) => !twins.has(event.type)) ?? null;

  return (
    <RunPage
      instance={instance}
      workflow={workflow}
      records={records}
      panel={panel}
      events={eventItems}
      author={author}
      operator={operator}
    />
  );
}

function defaultPanelOf(instance: Instance): RunPanel {
  return isUnended(instance.phase) ? "timeline" : "result";
}
