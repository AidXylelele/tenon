import "server-only";
import { workflows } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import type { FoundWorkflow } from "./found-workflow";

const PRIVATE = { "cache-control": "private, no-store" };

export async function workflowSearch(): Promise<Response> {
  try {
    const found = await searchable();
    return Response.json(found, { headers: PRIVATE });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return Response.json([], { status: 503, headers: PRIVATE });
  }
}

async function searchable(): Promise<FoundWorkflow[]> {
  const [active, archived] = await Promise.all([
    workflows("active"),
    workflows("archived"),
  ]);
  const all = active.items.concat(archived.items);
  return all.map((each) => ({
    namespace: each.namespace,
    name: each.name,
    on: each.on,
    archived: each.status === "archived",
  }));
}
