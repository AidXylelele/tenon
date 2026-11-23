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
import { versionHref } from "@/libs/routing/routes";
import { type Query, segment } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { VersionQuery } from "./query";
import type { SourceFile } from "./version-menu";
import { VersionPage } from "./version-page";

interface VersionParams {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

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

  const file = sourceFileOf(name, version, source, document);
  const page = versionHref(namespace, name, version);
  const hrefs = { flow: page, code: `${page}?view=code` };
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
      view={view}
      hrefs={hrefs}
      author={author}
      operator={operator}
    />
  );
}

function sourceFileOf(
  name: string,
  version: string,
  source: string | null,
  document: unknown,
): SourceFile {
  const json = source === null;
  const text = source ?? `${JSON.stringify(document, null, 2)}\n`;
  const kind = json ? "JSON" : "YAML";
  const extension = json ? "json" : "yaml";
  const encoded = encodeURIComponent(text);
  const href = `data:application/${extension};charset=utf-8,${encoded}`;
  const file = `${name}-${version}.${extension}`;
  return { text, kind, href, name: file };
}
