import { expect, test } from "vitest";
import {
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
} from "vscode-languageserver/browser";
import { documentRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { flow, greet, greetValue, pushed } from "../support/documents.js";
import { profile } from "../support/analyzer.js";
import {
  initializeParams,
  openSession,
  sessionWith,
  uri,
} from "../support/session.js";

const atVersion1 = { textDocument: { uri, version: 1 } };

test("the document is returned on its version", async () => {
  useFakeClock();
  const session = await sessionWith(greet);

  const answered = await session.client.sendRequest(
    documentRequest,
    atVersion1,
  );

  expect(answered).toEqual({
    kind: "document",
    version: 1,
    document: greetValue,
  });
});

test("a document that names another workflow than its draft is refused", async () => {
  useFakeClock();
  const session = openSession();
  const draft = { namespace: "sales", name: "lead-intake" };
  const initialize = {
    ...initializeParams,
    initializationOptions: { profile, draft },
  };
  const opened = {
    textDocument: { uri, languageId: "yaml", version: 1, text: greet },
  };
  await session.client.sendRequest(InitializeRequest.type, initialize);
  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    opened,
  );

  const answered = await session.client.sendRequest(
    documentRequest,
    atVersion1,
  );

  expect(answered).toMatchObject({
    kind: "refused",
    diagnostics: [{ code: "draft-address", source: "workflow" }],
  });
});

test("a document with a diagnostic is refused with the pushed diagnostics", async () => {
  useFakeClock();
  const session = await sessionWith(flow);

  const answered = await session.client.sendRequest(
    documentRequest,
    atVersion1,
  );

  expect(answered).toEqual({
    kind: "refused",
    version: 1,
    diagnostics: [pushed],
  });
});

test("an older version is content modified", async () => {
  useFakeClock();
  const session = await sessionWith(greet);
  const changed = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: greet }],
  };
  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    changed,
  );

  const refused = session.client.sendRequest(documentRequest, atVersion1);

  await expect(refused).rejects.toMatchObject({
    code: -32801,
    message: "The request names version 1; the document is at version 2.",
  });
});

test("a document that is not open fails", async () => {
  useFakeClock();
  const session = await sessionWith(greet);
  const elsewhere = { textDocument: { uri: "file:///none.yaml", version: 1 } };

  const refused = session.client.sendRequest(documentRequest, elsewhere);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "The document file:///none.yaml is not open.",
  });
});

test("params of another shape are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(greet);
  const unversioned = { textDocument: { uri } };

  const refused = session.client.sendRequest(
    documentRequest.method,
    unversioned,
  );

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  const answered = await session.client.sendRequest(
    documentRequest,
    atVersion1,
  );

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
