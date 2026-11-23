import { z } from "zod";
import type { InstanceOrder, Phase } from "@/libs/data-access/types";
import { runsHref } from "@/libs/routing/routes";
import { queryText } from "@/libs/routing/segment";
import {
  type RunStatus,
  type Started,
  startedOf,
  statusesOf,
  statusOf,
  statusParamOf,
} from "@/operations/run-periods";
import { PHASES } from "@/operations/run-progress";

const SIZES = [25, 50, 100];

const COUNTED = 10_000;

const ORDERS: readonly InstanceOrder[] = ["started", "duration"];

export interface RunsAddress {
  readonly namespace: string | undefined;
  readonly name: string | undefined;
  readonly version: string | undefined;
  readonly statuses: readonly RunStatus[];
  readonly started: Started;
  readonly page: number;
  readonly size: number;
  readonly sort: InstanceOrder;
}

const Read = z.object({
  namespace: queryText,
  name: queryText,
  version: queryText,
  status: queryText,
  phase: z.enum(PHASES).optional().catch(undefined),
  started: queryText,
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce
    .number()
    .int()
    .refine((size) => SIZES.includes(size))
    .catch(50),
  sort: z.enum(ORDERS).catch("started"),
});

export function runsAddressOf(query: unknown): RunsAddress {
  const read = Read.parse(query);
  const statuses = statusesWith(read.status, read.phase);
  const started = startedOf(read.started) ?? "all";
  const lastPage = Math.ceil(COUNTED / read.size);
  const page = Math.min(read.page, lastPage);
  return {
    namespace: read.namespace,
    name: read.name,
    version: read.version,
    statuses,
    started,
    page,
    size: read.size,
    sort: read.sort,
  };
}

export function runsHrefOf(address: RunsAddress): string {
  const status = statusParamOf(address.statuses);
  const started = address.started === "all" ? undefined : address.started;
  const page = address.page === 1 ? undefined : address.page;
  const size = address.size === 50 ? undefined : address.size;
  const sort = address.sort === "started" ? undefined : address.sort;
  return runsHref({
    namespace: address.namespace,
    name: address.name,
    version: address.version,
    status,
    started,
    page,
    size,
    sort,
  });
}

export function isFiltered(address: RunsAddress): boolean {
  const chosen = [address.namespace, address.version];
  const named = chosen.some((value) => value !== undefined);
  return named || address.statuses.length > 0 || address.started !== "all";
}

function statusesWith(
  param: string | undefined,
  phase: Phase | undefined,
): readonly RunStatus[] {
  const statuses = statusesOf(param);

  if (phase === undefined) return statuses;

  const counted = statusOf(phase);
  const joined = statuses.concat([counted]);
  return statusesOf(statusParamOf(joined));
}
