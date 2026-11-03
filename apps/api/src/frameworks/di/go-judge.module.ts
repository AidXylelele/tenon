import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxClient, SandboxLimits } from '../runtime/interfaces.js';
import { GoJudgeSandboxClient } from '../go-judge/go-judge-sandbox.client.js';
import { createSandboxPool, SandboxPool } from '../go-judge/sandbox-pool.js';
import type { Env } from './config.module.js';

@Module({
  providers: [
    {
      provide: SandboxPool,
      inject: [ConfigService, SandboxLimits],
      useFactory: (config: ConfigService<Env, true>, limits: SandboxLimits) =>
        createSandboxPool(
          config.get('SANDBOX_URL', { infer: true }),
          config.get('SANDBOX_TOKEN', { infer: true }),
          limits,
        ),
    },
    {
      provide: SandboxLimits,
      useValue: {
        seconds: 30,
        memoryBytes: 256 * 1024 * 1024,
        processes: 50,
        outputBytes: 1024 * 1024,
      },
    },
    GoJudgeSandboxClient,
    { provide: SandboxClient, useExisting: GoJudgeSandboxClient },
  ],
  exports: [SandboxClient, SandboxLimits],
})
export class GoJudgeModule implements OnApplicationShutdown {
  constructor(private readonly pool: SandboxPool) {}

  onApplicationShutdown(): Promise<void> {
    return this.pool.close();
  }
}
