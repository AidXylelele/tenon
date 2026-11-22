import { expect, test } from "vitest";
import type { HoverParams } from "vscode-languageserver/browser";
import { initialized, openSession } from "../support/session.js";

const hoverParams: HoverParams = {
  textDocument: { uri: "file:///a.yaml" },
  position: { line: 0, character: 0 },
};

test("initialize answers the server's capabilities", async () => {
  const session = openSession();

  const answered = await initialized(session);

  expect(answered).toEqual({
    capabilities: {
      textDocumentSync: { openClose: true, change: 2 },
      completionProvider: { triggerCharacters: ["$"] },
      hoverProvider: true,
      codeActionProvider: { codeActionKinds: ["quickfix"] },
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: true,
    },
  });
});

test("a request before initialize is not initialized", async () => {
  const session = openSession();

  const refused = session.client.sendRequest("textDocument/hover", hoverParams);

  await expect(refused).rejects.toMatchObject({ code: -32002 });
});

test("shutdown before initialize is not initialized", async () => {
  const session = openSession();

  const refused = session.client.sendRequest("shutdown");

  await expect(refused).rejects.toMatchObject({ code: -32002 });
});

test("initialize is answered once", async () => {
  const session = openSession();
  await initialized(session);

  const refused = initialized(session);

  await expect(refused).rejects.toMatchObject({
    code: -32600,
    data: { retry: false },
  });
});

test("after shutdown a request without a handler of its own is invalid", async () => {
  const session = openSession();
  await initialized(session);
  await session.client.sendRequest("shutdown");

  const refused = session.client.sendRequest("textDocument/hover", hoverParams);

  await expect(refused).rejects.toMatchObject({ code: -32600 });
});

test("after shutdown a registered request is invalid", async () => {
  const session = openSession();
  await initialized(session);
  await session.client.sendRequest("shutdown");

  const refused = session.client.sendRequest("shutdown");

  await expect(refused).rejects.toMatchObject({ code: -32600 });
});

test.each(["workflow/nothing", "$/nothing"])(
  "an unknown method %s is not found",
  async (method) => {
    const session = openSession();
    await initialized(session);

    const refused = session.client.sendRequest(method);

    await expect(refused).rejects.toMatchObject({ code: -32601 });
  },
);
