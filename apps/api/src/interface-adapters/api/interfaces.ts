import type { HealthIndicatorResult } from '@nestjs/terminus';

// Whether the platform's database answers, for the health route that load balancers ask.
export abstract class DatabaseProbe {
  abstract isReachable(): PromiseLike<HealthIndicatorResult>;
}
