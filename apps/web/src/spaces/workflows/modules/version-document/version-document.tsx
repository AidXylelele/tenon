import { DownloadIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  versionDocument,
  versions,
  versionSource,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { Link } from "@/libs/routing/link";
import { editorHref } from "@/libs/routing/routes";
import { segment } from "@/libs/routing/segment";
import { Badge } from "@/libs/ui/components/badge";
import { Button } from "@/libs/ui/components/button";
import { CopyButton } from "@/libs/ui/composites/copy-button";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Time } from "@/libs/ui/composites/time";
import { SourceView } from "@/features/code-editor";
import { Unavailable } from "@/libs/ui/composites/unavailable";

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
}: {
  readonly params: VersionParams;
}) {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const version = segment(params.version);
  const read = await available(
    Promise.all([
      currentSession(),
      versionSource(namespace, name, version),
      versions(namespace, name),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, source, published] = read;
  const reading =
    source === null ? versionDocument(namespace, name, version) : null;
  const document = await available(Promise.resolve(reading));

  if (document === UNAVAILABLE) return <Unavailable />;

  if (source === null && document === null) notFound();

  const text = source ?? `${JSON.stringify(document, null, 2)}\n`;
  const format = source === null ? "json" : "yaml";
  const download = `data:application/${format};charset=utf-8,${encodeURIComponent(text)}`;
  const facts = published.find((each) => each.version === version);
  const title = `Version ${version}`;
  const file = `${name}-${version}.${format}`;

  return (
    <>
      <PageHeader
        title={title}
        description={
          facts === undefined ? undefined : (
            <span className="flex flex-wrap items-center gap-2">
              <span>
                Published <Time value={facts.publishedAt} /> by{" "}
                {facts.publishedBy.name}
              </span>
              {facts.current && <Badge variant="secondary">Current</Badge>}
            </span>
          )
        }
        actions={
          <>
            <CopyButton value={text} label="Copy" size="sm" />
            <Button variant="outline" asChild>
              <a href={download} download={file}>
                <DownloadIcon data-icon="inline-start" />
                Download
              </a>
            </Button>
            {session?.capabilities.author === true && (
              <Button asChild>
                <Link href={editorHref(namespace, name)}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Link>
              </Button>
            )}
          </>
        }
      />
      <SourceView text={text} label={title} />
    </>
  );
}
