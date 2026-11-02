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
        jq: { timeout: '1s' },
        documents: { timeout: '2s' },
        schemas: { timeout: '1s' },
      },
    }),
  ],
})
export class ResilienceModule {}
