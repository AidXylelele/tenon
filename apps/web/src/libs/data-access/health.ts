import "server-only";
import { ApiError, send } from "./http";

export async function platformReady(): Promise<boolean> {
  try {
    const response = await send("/health/ready", { anonymous: true });
    await response.body?.cancel();
    return response.ok;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    return false;
  }
}
