import { z } from "zod";
import type { InstanceOrder, Phase } from "@/libs/data-access/types";
import { runsHref } from "@/libs/routing/routes";
import { queryText } from "@/libs/routing/segment";
import {
  type Started,
  startedOf,
  type TimeWindow,
} from "@/operations/run-periods";
import {
  PHASES,
  type RunStatus,
  statusesOf,
  statusOf,
  statusParamOf,
} from "@/operations/run-progress";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/features/run-table";

const COUNTED = 10_000;

const ORDERS: readonly InstanceOrder[] = ["started", "duration"];

export interface RunsAddress {
  readonly namespace: string | undefined;
  readonly name: string | undefined;
  readonly version: string | undefined;
  readonly statuses: readonly RunStatus[];
  readonly started: Started;
  readonly between: TimeWindow | null;
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
  from: z.iso.datetime({ offset: true }).optional().catch(undefined),
  to: z.iso.datetime({ offset: true }).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce
    .number()
    .int()
    .refine((size) => PAGE_SIZES.includes(size))
    .catch(DEFAULT_PAGE_SIZE),
  sort: z.enum(ORDERS).catch("started"),
});

export function runsAddressOf(query: unknown): RunsAddress {
  const read = Read.parse(query);
  const statuses = statusesWith(read.status, read.phase);
  const started = startedOf(read.started) ?? "all";
  const between = betweenOf(read.from, read.to);
  const lastPage = Math.ceil(COUNTED / read.size);
  const page = Math.min(read.page, lastPage);
  return {
    namespace: read.namespace,
    name: read.name,
    version: read.version,
    statuses,
    started,
    between,
    page,
    size: read.size,
    sort: read.sort,
  };
}

export function runsHrefOf(address: RunsAddress): string {
  const status = statusParamOf(address.statuses);
  const started = address.started === "all" ? undefined : address.started;
  const page = address.page === 1 ? undefined : address.page;
  const size = address.size === DEFAULT_PAGE_SIZE ? undefined : address.size;
  const sort = address.sort === "started" ? undefined : address.sort;
  return runsHref({
    namespace: address.namespace,
    name: address.name,
    version: address.version,
    status,
    started,
    from: address.between?.from,
    to: address.between?.to,
    page,
    size,
    sort,
  });
}

export function hasFilters(address: RunsAddress): boolean {
  const chosen = [address.namespace, address.version];
  const named = chosen.some((value) => value !== undefined);
  return named || address.statuses.length > 0 || address.between !== null;
}

export function isFiltered(address: RunsAddress): boolean {
  const chosen = [address.namespace, address.version];
  const named = chosen.some((value) => value !== undefined);
  const timed = address.started !== "all" || address.between !== null;
  return named || address.statuses.length > 0 || timed;
}

function betweenOf(
  from: string | undefined,
  to: string | undefined,
): TimeWindow | null {
  if (from === undefined || to === undefined) return null;

  const ordered = Date.parse(from) < Date.parse(to);

  if (!ordered) return null;

  return { from, to };
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
