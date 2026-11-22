import "server-only";
import { instanceCounts } from "@/libs/data-access/automation";
import { ApiError } from "@/libs/data-access/http";
import { phasesOf } from "@/operations/run-periods";

const EPOCH = new Date(0).toISOString();
const IN_PROGRESS = phasesOf("in-progress");

export async function inProgressNow(): Promise<number> {
  const now = new Date().toISOString();

  try {
    const read = await instanceCounts(EPOCH, now);
    return IN_PROGRESS.reduce((sum, phase) => sum + read.counts[phase], 0);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return 0;
  }
}
