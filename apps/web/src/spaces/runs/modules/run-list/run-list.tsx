import { instances, workflows } from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { ViewerZone } from "@/libs/live/viewer-zone";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { phasesOf, windowsOf } from "@/operations/run-periods";
import type { KnownWorkflow } from "./filters";
import { type RunsAddress, runsAddressOf } from "./runs-address";
import { RunsPage } from "./runs-page";

export async function RunList({ query }: { readonly query: Query }) {
  const address = runsAddressOf(query);
  const zone = await viewerZone();
  const from = address.between?.from ?? startOf(address, zone);
  const to = address.between?.to;
  const phases = address.statuses.flatMap((status) => phasesOf(status));
  const read = await available(
    Promise.all([
      currentSession(),
      instances({
        namespace: address.namespace,
        name: address.name,
        version: address.version,
        phases,
        from,
        to,
        sort: address.sort,
        page: address.page,
        limit: address.size,
      }),
      workflows("active"),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, page, active] = read;
  const operator = session?.capabilities.operator === true;
  const known: KnownWorkflow[] = active.items.map((workflow) => ({
    namespace: workflow.namespace,
    name: workflow.name,
  }));

  return (
    <>
      <ViewerZone zone={zone} />
      <RunsPage
        address={address}
        zone={zone}
        page={page}
        workflows={known}
        operator={operator}
      />
    </>
  );
}

function startOf(address: RunsAddress, zone: string): string | undefined {
  if (address.started === "all") return undefined;

  const now = new Date().toISOString();
  const windows = windowsOf(address.started, now, zone);
  return windows.current.from;
}
