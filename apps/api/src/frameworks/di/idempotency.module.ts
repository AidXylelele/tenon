import { Module } from '@nestjs/common';
import { IdempotencyModule as NestIdempotencyModule } from '@nestjs/idempotency';
import { DrizzleIdempotencyStore } from '../../interface-adapters/persistence/stores/drizzle-idempotency.store.js';

interface SignedInRequest {
  readonly user?: { readonly id: string };
}

@Module({
  imports: [
    NestIdempotencyModule.forRoot({
      scope: (request: SignedInRequest) => request.user?.id,
    }),
  ],
  providers: [DrizzleIdempotencyStore],
})
export class IdempotencyModule {}
