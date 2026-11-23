import type { OutboxHandlerContext, OutboxMessage } from "@nestjs/outbox";
import { AesGcmCipher } from "../../src/frameworks/crypto/aes-gcm.cipher.js";
import { RunDataMapper } from "../../src/interface-adapters/messaging/mappers/run-data.mapper.js";

const SECRETS_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

export const runDataMapper = new RunDataMapper(new AesGcmCipher(SECRETS_KEY));

export function aHandlerContext(
  topic: string,
  consumer: string,
  attempt = 1,
): OutboxHandlerContext {
  const message = {
    id: "message-1",
    topic,
    payload: {},
    headers: {},
    key: null,
    createdAt: 0,
    availableAt: 0,
    attempts: attempt - 1,
    lastError: null,
  } as OutboxMessage;
  return {
    message,
    consumer,
    attempt,
    signal: new AbortController().signal,
    processInTransaction: () => Promise.reject(new Error("Not used")),
  };
}
