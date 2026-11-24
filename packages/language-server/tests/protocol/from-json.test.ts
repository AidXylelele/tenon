import { expect, test } from "vitest";
import { fromJsonRequest } from "../../src/lsp/extensions/index.js";
import { greetText, greetValue } from "../support/documents.js";
import { initialized, openSession } from "../support/session.js";

test("JSON comes back as text", async () => {
  const session = openSession();
  await initialized(session);
  const params = { document: greetValue };

  const answered = await session.client.sendRequest(fromJsonRequest, params);

  expect(answered).toEqual({ text: greetText });
});

test("params of another shape are invalid", async () => {
  const session = openSession();
  await initialized(session);

  const refused = session.client.sendRequest(fromJsonRequest.method, {});

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  const session = openSession();
  await initialized(session);
  const params = { document: greetValue };
  const answered = await session.client.sendRequest(fromJsonRequest, params);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
