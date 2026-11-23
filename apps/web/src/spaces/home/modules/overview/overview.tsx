import {
  expectedStarts,
  failingWorkflows,
  instanceCounts,
  instances,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { ViewerZone } from "@/libs/live/viewer-zone";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { countWindowOf, windowsOf } from "@/operations/run-periods";
import { periodOf } from "./home-address";
import { HomePage } from "./home-page";

const FAILING_SHOWN = 5;

export async function Overview({ query }: { readonly query: Query }) {
  const period = periodOf(query);
  const zone = await viewerZone();
  const now = new Date().toISOString();
  const windows = windowsOf(period, now, zone);
  const window = countWindowOf(windows);
  const read = await available(
    Promise.all([
      instanceCounts(window),
      failingWorkflows({
        from: windows.current.from,
        to: windows.current.to,
        limit: FAILING_SHOWN,
      }),
      instances({ phases: ["suspended"], limit: FAILING_SHOWN }),
      expectedStarts(windows.current.from),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [counts, failing, paused, expected] = read;

  return (
    <>
      <ViewerZone zone={zone} />
      <HomePage
        period={period}
        zone={zone}
        windows={windows}
        counts={counts}
        failing={failing}
        paused={paused.items}
        expected={expected}
      />
    </>
  );
}
