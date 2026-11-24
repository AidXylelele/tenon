import "server-only";
import { versionDocument, versionSource } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { segment } from "@/libs/routing/segment";
import type { VersionParams } from "./interfaces";

const PRIVATE = "private, no-store";

function attachment(text: string, type: string, file: string): Response {
  const headers = {
    "content-type": `${type}; charset=utf-8`,
    "content-disposition": `attachment; filename="${file}"`,
    "cache-control": PRIVATE,
  };
  return new Response(text, { headers });
}

function emptyAnswer(status: number): Response {
  return new Response(null, { status, headers: { "cache-control": PRIVATE } });
}

export async function sourceDownload(params: VersionParams): Promise<Response> {
  try {
    return await download(params);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return emptyAnswer(503);
  }
}

async function download(params: VersionParams): Promise<Response> {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const version = segment(params.version);
  const source = await versionSource(namespace, name, version);
  const stem = `${name}-${version}`;

  if (source !== null)
    return attachment(source, "application/yaml", `${stem}.yaml`);

  const document = await versionDocument(namespace, name, version);

  if (document === null) return emptyAnswer(404);

  const text = `${JSON.stringify(document, null, 2)}\n`;
  return attachment(text, "application/json", `${stem}.json`);
}
