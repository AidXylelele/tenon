import { vi } from 'vitest';
import type * as TransactionalModule from '@nestjs-cls/transactional';

// `@Transactional()` resolves the TransactionHost on every call, which only a Nest module
// registers. Solitary tests construct use cases with `new`, so the decorator is a no-op here
// (the library's documented "Mocking the decorator import"); the boundary itself is proven
// by the component tests on the real stack.
vi.mock('@nestjs-cls/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionalModule>();
  const Transactional = (): MethodDecorator => () => undefined;
  return { ...actual, Transactional };
});
