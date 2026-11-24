import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  versionDocument,
  versionSource,
  versionStructure,
  versions as versionsOf,
  workflow as workflowOf,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { versionHref, versionSourceHref } from "@/libs/routing/routes";
import { type Query, segment } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { VersionQuery } from "./query";
import type { VersionParams } from "./interfaces";
import type { VersionSource } from "./version-menu";
import { VersionPage } from "./version-page";

export function versionMetadata(params: VersionParams): Metadata {
  const name = segment(params.name);
  const version = segment(params.version);
  return { title: `${name} ${version}` };
}

export async function VersionDocument({
  params,
  query,
}: {
  readonly params: VersionParams;
  readonly query: Query;
}) {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const version = segment(params.version);
  const view = VersionQuery.parse(query).view;
  const read = await available(
    Promise.all([
      currentSession(),
      workflowOf(namespace, name),
      versionsOf(namespace, name),
      versionSource(namespace, name, version),
      versionStructure(namespace, name, version),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, workflow, published, source, structure] = read;
  const reading =
    source === null ? versionDocument(namespace, name, version) : null;
  const document = await available(Promise.resolve(reading));

  if (document === UNAVAILABLE) return <Unavailable />;

  if (workflow === null || (source === null && document === null)) notFound();

  const text = source ?? `${JSON.stringify(document, null, 2)}\n`;
  const kind: VersionSource["kind"] = source === null ? "JSON" : "YAML";
  const file = { text, kind };
  const download = versionSourceHref(namespace, name, version);
  const flow = versionHref(namespace, name, version);
  const code = versionHref(namespace, name, version, { view: "code" });
  const hrefs = { flow, code };
  const newestFirst = published.slice().reverse();
  const author = session?.capabilities.author === true;
  const operator = session?.capabilities.operator === true;

  return (
    <VersionPage
      workflow={workflow}
      version={version}
      versions={newestFirst}
      structure={structure}
      file={file}
      download={download}
      view={view}
      hrefs={hrefs}
      author={author}
      operator={operator}
    />
  );
}
