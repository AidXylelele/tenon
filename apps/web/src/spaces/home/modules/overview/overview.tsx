import {
  expectedStarts,
  failingWorkflows,
  instanceCounts,
  instances,
} from "@/libs/data-access/automation";
import { available, UNAVAILABLE, viewerZone } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import { ViewerZone } from "@/libs/live/viewer-zone";
import type { Query } from "@/libs/routing/segment";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { countWindowOf, windowsOf } from "@/operations/run-periods";
import { periodOf } from "./home-address";
import { HomePage } from "./home-page";

const FAILING_READ = 100;

const PAUSED_SHOWN = 5;

export async function Overview({ query }: { readonly query: Query }) {
  const period = periodOf(query);
  const zone = await viewerZone();
  const now = new Date().toISOString();
  const windows = windowsOf(period, now, zone);
  const window = countWindowOf(windows);
  const read = await available(
    Promise.all([
      currentSession(),
      instanceCounts(window),
      failingWorkflows({
        from: windows.current.from,
        to: windows.current.to,
        limit: FAILING_READ,
      }),
      instances({ phases: ["suspended"], limit: PAUSED_SHOWN }),
      expectedStarts(windows.current.from),
    ]),
  );

  if (read === UNAVAILABLE) return <Unavailable />;

  const [session, counts, failing, paused, expected] = read;
  const operator = session?.capabilities.operator === true;
  const author = session?.capabilities.author === true;

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
        operator={operator}
        author={author}
      />
    </>
  );
}
