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
        'subscriber-delivery': {
          timeout: '10s',
          circuitBreaker: {
            failureRateThreshold: 50,
            minimumCalls: 10,
            openDuration: '30s',
          },
        },
        processes: {
          timeout: '35s',
          bulkhead: { maxConcurrent: 8, maxQueue: 0 },
        },
      },
    }),
  ],
})
export class ResilienceModule {}
