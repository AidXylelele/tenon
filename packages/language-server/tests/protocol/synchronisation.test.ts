import { expect, test } from "vitest";
import {
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import { initialized, openSession, roundTrip } from "../support/session.js";

const openParams = {
  textDocument: {
    uri: "file:///a.yaml",
    languageId: "yaml",
    version: 1,
    text: "do: []\n",
  },
};

const closeParams = { textDocument: { uri: "file:///a.yaml" } };

test("closing an open document clears its diagnostics", async () => {
  useFakeClock();
  const session = openSession();
  await initialized(session);
  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    openParams,
  );

  await session.client.sendNotification(
    DidCloseTextDocumentNotification.type,
    closeParams,
  );
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///a.yaml", diagnostics: [] },
    },
  ]);
});

test("a document opened before initialize is not held", async () => {
  useFakeClock();
  const session = openSession();
  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    openParams,
  );
  await initialized(session);

  await session.client.sendNotification(
    DidCloseTextDocumentNotification.type,
    closeParams,
  );
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([]);
});

test("a document closed after shutdown publishes nothing", async () => {
  useFakeClock();
  const session = openSession();
  await initialized(session);
  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    openParams,
  );
  await session.client.sendRequest("shutdown");

  await session.client.sendNotification(
    DidCloseTextDocumentNotification.type,
    closeParams,
  );
  await roundTrip(session);

  expect(session.received).toEqual([]);
});
