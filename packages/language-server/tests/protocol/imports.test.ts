import { expect, test, vi } from "vitest";
import {
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from "vscode-languageserver/browser";
import { didFetchImportsNotification } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { logText, U, unresolved, uriFlow } from "../support/documents.js";
import {
  initialized,
  openSession,
  roundTrip,
  type Session,
} from "../support/session.js";

const uri = "file:///catalogs.yaml";

const asked = {
  method: "workflow/importsNeeded",
  params: { textDocument: { uri }, imports: [{ reference: U, uri: U }] },
};

async function askedSession(): Promise<Session> {
  useFakeClock();
  const session = openSession();
  await initialized(session);
  const opened = {
    textDocument: { uri, languageId: "yaml", version: 1, text: uriFlow },
  };
  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    opened,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);

  return session;
}

test("the server asks once and re-analyses with the texts", async () => {
  const session = await askedSession();
  const fetched = { textDocument: { uri }, texts: { [U]: logText } };

  await session.client.sendNotification(didFetchImportsNotification, fetched);
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toMatchObject([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: unresolved },
    },
    asked,
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [] },
    },
  ]);
});

test("a change does not ask again", async () => {
  const session = await askedSession();
  const changed = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: uriFlow }],
  };

  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    changed,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toMatchObject([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: unresolved },
    },
    asked,
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 2, diagnostics: unresolved },
    },
  ]);
});

test("a failed fetch says why, until a text for it arrives", async () => {
  const session = await askedSession();
  const failed = {
    textDocument: { uri },
    texts: {},
    failures: { [U]: "The host answered 404." },
  };
  const fetched = { textDocument: { uri }, texts: { [U]: logText } };
  const explained = {
    code: "unresolved-import",
    message: `Import '${U}' could not be fetched: The host answered 404.`,
  };

  await session.client.sendNotification(didFetchImportsNotification, failed);
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendNotification(didFetchImportsNotification, fetched);
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toMatchObject([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: unresolved },
    },
    asked,
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [explained, explained] },
    },
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [] },
    },
  ]);
});
