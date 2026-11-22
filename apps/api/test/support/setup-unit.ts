import { vi } from "vitest";
import type * as TransactionalModule from "@nestjs-cls/transactional";

vi.mock("@nestjs-cls/transactional", async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionalModule>();
  const Transactional = (): MethodDecorator => () => undefined;
  return { ...actual, Transactional };
});

afterEach(() => {
  vi.useRealTimers();
});
