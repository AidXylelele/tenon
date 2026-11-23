import "server-only";
import { versionStructure } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { segment } from "@/libs/routing/segment";
import type { VersionParams } from "./interfaces";

const PRIVATE = { "cache-control": "private, no-store" };

export async function publishedSteps(params: VersionParams): Promise<Response> {
  const namespace = segment(params.namespace);
  const name = segment(params.name);
  const version = segment(params.version);

  try {
    const structure = await versionStructure(namespace, name, version);

    if (structure === null) return emptyAnswer(404);

    return Response.json(structure.steps, { headers: PRIVATE });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return emptyAnswer(503);
  }
}

function emptyAnswer(status: number): Response {
  return new Response(null, { status, headers: PRIVATE });
}
