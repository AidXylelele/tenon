import { z } from "zod";
import type { InstanceFilter } from "@/libs/data-access/types";
import { STARTED_WITHIN, type StartedWithin } from "@/libs/routing/routes";
import { queryText } from "@/libs/routing/segment";
import { PHASES } from "@/operations/run-progress";
import type { CountWindow } from "./interfaces";

export const PERIODS: Readonly<
  Record<StartedWithin, { readonly label: string; readonly ms: number }>
> = {
  "1h": { label: "Last hour", ms: 3_600_000 },
  "24h": { label: "Last 24 hours", ms: 86_400_000 },
  "7d": { label: "Last 7 days", ms: 604_800_000 },
};

const EPOCH = new Date(0).toISOString();

export const RunListQuery = z.object({
  namespace: queryText,
  name: queryText,
  version: queryText,
  phase: z.enum(PHASES).optional().catch(undefined),
  started: z.enum(STARTED_WITHIN).optional().catch(undefined),
  cursor: queryText,
});

export type RunListQuery = z.infer<typeof RunListQuery>;

export function isFiltered(query: RunListQuery): boolean {
  const chosen = [
    query.namespace,
    query.name,
    query.version,
    query.phase,
    query.started,
  ];
  return chosen.some((value) => value !== undefined);
}

export function filterOf(query: RunListQuery): InstanceFilter {
  const startedFrom =
    query.started === undefined ? undefined : sinceOf(query.started);
  return {
    namespace: query.namespace,
    name: query.name,
    version: query.version,
    phase: query.phase,
    startedFrom,
    cursor: query.cursor,
  };
}

export function countWindowOf(query: RunListQuery): CountWindow {
  const to = new Date().toISOString();

  if (query.started === undefined)
    return { title: "All runs of every workflow", from: EPOCH, to };

  const title = `${PERIODS[query.started].label}, every workflow`;
  return { title, from: sinceOf(query.started), to };
}

function sinceOf(started: StartedWithin): string {
  const at = Date.now() - PERIODS[started].ms;
  return new Date(at).toISOString();
}
