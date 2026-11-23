import "server-only";
import { instanceCounts } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { inProgressOf } from "@/operations/run-periods";

const MINUTE_MS = 60_000;

export async function inProgressNow(): Promise<number> {
  const at = Date.now();
  const now = new Date(at).toISOString();
  const minuteAgo = new Date(at - MINUTE_MS).toISOString();

  try {
    const read = await instanceCounts({ buckets: [minuteAgo], to: now });
    return inProgressOf(read.now);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return 0;
  }
}
