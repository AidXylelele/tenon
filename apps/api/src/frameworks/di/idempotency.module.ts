import { Module } from '@nestjs/common';
import { IdempotencyModule as NestIdempotencyModule } from '@nestjs/idempotency';
import type { User } from '../../domain/identity/user.js';
import { DrizzleIdempotencyStore } from '../../interface-adapters/persistence/stores/drizzle-idempotency.store.js';

@Module({
  imports: [
    NestIdempotencyModule.forRoot({
      scope: (request: { readonly user?: User }) => request.user?.id,
    }),
  ],
  providers: [DrizzleIdempotencyStore],
})
export class IdempotencyModule {}
