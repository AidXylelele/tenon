import type { HealthIndicatorResult } from '@nestjs/terminus';

// What the health route asks the platform's tools, for the load balancers that ask it.
export abstract class HealthClient {
  abstract database(): PromiseLike<HealthIndicatorResult>;
}
