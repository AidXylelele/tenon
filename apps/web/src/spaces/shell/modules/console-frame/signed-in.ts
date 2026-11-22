import "server-only";
import { ApiError } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import type { Session } from "@/libs/data-access/types";

export async function signedIn(): Promise<Session | null> {
  try {
    return await currentSession();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return null;
  }
}
