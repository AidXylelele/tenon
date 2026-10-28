import { IdempotencyStorage } from '@nestjs/idempotency';
import { idempotencyStoreContract } from '@nestjs/idempotency/testing';
import { DrizzleIdempotencyStore } from '../../../src/interface-adapters/persistence/stores/drizzle-idempotency.store.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';

describe('DrizzleIdempotencyStore', () => {
  let t: TestApp;
  let store: DrizzleIdempotencyStore;

  beforeAll(async () => {
    t = await createTestApp();
    store = new DrizzleIdempotencyStore(t.db, new IdempotencyStorage());
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const cases = idempotencyStoreContract(() => store, {
    advanceTime: (ms) => vi.setSystemTime(Date.now() + ms),
    concurrent: true,
  });

  for (const contractCase of cases) {
    it(contractCase.name, contractCase.run);
  }
});
