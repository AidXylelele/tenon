import { Module } from '@nestjs/common';
import { ResilienceModule as NestResilienceModule } from '@nestjs/resilience';

@Module({
  imports: [
    NestResilienceModule.forRoot({
      presets: {
        'service-calls': {
          timeout: '30s',
          bulkhead: { maxConcurrent: 64, maxQueue: 0 },
        },
        // go-judge's ES_PARALLELISM covers this bulkhead in every process (compose.yaml).
        processes: {
          timeout: '35s',
          bulkhead: { maxConcurrent: 8, maxQueue: 0 },
        },
        // The bound of a runaway program or schema, not of an ordinary one: it counts the wait
        // for a worker and the main thread's delays too, which a loaded process stretches.
        jq: { timeout: '5s' },
        schemas: { timeout: '5s' },
      },
    }),
  ],
})
export class ResilienceModule {}
