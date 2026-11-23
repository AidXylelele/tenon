import "server-only";
import { instanceCounts } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { inProgressOf, liveWindowOf } from "@/operations/run-periods";

export async function inProgressNow(): Promise<number> {
  const now = new Date().toISOString();
  const window = liveWindowOf(now);

  try {
    const read = await instanceCounts(window);
    return inProgressOf(read.now);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return 0;
  }
}
