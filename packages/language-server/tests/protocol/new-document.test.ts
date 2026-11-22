import { standardVersion } from "interpreter/front-end";
import { expect, test } from "vitest";
import { newDocumentRequest } from "../../src/lsp/extensions/index.js";
import { initialized, openSession } from "../support/session.js";

const header = { namespace: "sales", name: "onboarding", version: "1.0.0" };

test("a new document comes back as its text", async () => {
  const session = openSession();
  await initialized(session);

  const answered = await session.client.sendRequest(newDocumentRequest, header);

  expect(answered).toEqual({
    kind: "text",
    text: `document:\n  dsl: ${standardVersion}\n  namespace: sales\n  name: onboarding\n  version: 1.0.0\ndo: []\n`,
  });
});

test("a value the grammar does not admit is named", async () => {
  const session = openSession();
  await initialized(session);
  const params = { ...header, name: "on boarding" };

  const answered = await session.client.sendRequest(newDocumentRequest, params);

  expect(answered).toEqual({ kind: "refused", params: ["name"] });
});

test("a param that is not a string is invalid", async () => {
  const session = openSession();
  await initialized(session);
  const params = { ...header, version: 1 };

  const refused = session.client.sendRequest(newDocumentRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  const session = openSession();
  await initialized(session);
  const answered = await session.client.sendRequest(newDocumentRequest, header);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
