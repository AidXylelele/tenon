import type { ThrottlerStorage } from "@nestjs/throttler";

export class UncountedRequests implements ThrottlerStorage {
  increment(
    _key: string,
    ttl: number,
  ): ReturnType<ThrottlerStorage["increment"]> {
    return Promise.resolve({
      totalHits: 1,
      timeToExpire: ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}
