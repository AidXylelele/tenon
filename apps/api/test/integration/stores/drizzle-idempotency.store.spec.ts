import { IdempotencyStorage } from '@nestjs/idempotency';
import { idempotencyStoreContract } from '@nestjs/idempotency/testing';
import { DrizzleIdempotencyStore } from '../../../src/interface-adapters/persistence/stores/drizzle-idempotency.store.js';
import { Database } from '../../../src/interface-adapters/interfaces.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

describe('DrizzleIdempotencyStore', () => {
  let t: TestApp;
  let store: DrizzleIdempotencyStore;

  beforeAll(async () => {
    t = await createTestApp();
    store = new DrizzleIdempotencyStore(
      t.app.get(Database),
      new IdempotencyStorage(),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await truncateAll(t.db);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const contractCase of idempotencyStoreContract(() => store, {
    advanceTime: (ms) => vi.setSystemTime(Date.now() + ms),
    concurrent: true,
  })) {
    it(contractCase.name, () => contractCase.run());
  }
});
