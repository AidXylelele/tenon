import { expect, test, vi } from "vitest";
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
} from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import {
  flow,
  pushed,
  surrogateFlow,
  unreadable,
} from "../support/documents.js";
import { roundTrip, sessionWith, uri } from "../support/session.js";

test("an error is pushed with its version", async () => {
  useFakeClock();
  const session = await sessionWith(flow);

  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [pushed] },
    },
  ]);
});

test("its fix clears it", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  const fix = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ range: pushed.range, text: "end" }],
  };

  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    fix,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [pushed] },
    },
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 2, diagnostics: [] },
    },
  ]);
});

test("three quick changes give one push, of the last version", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  await roundTrip(session);
  const second = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: flow }],
  };
  const third = {
    textDocument: { uri, version: 3 },
    contentChanges: [{ text: flow }],
  };
  const fourth = {
    textDocument: { uri, version: 4 },
    contentChanges: [{ text: flow }],
  };

  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    second,
  );
  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    third,
  );
  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    fourth,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 4, diagnostics: [pushed] },
    },
  ]);
});

test("a column after a surrogate pair counts UTF-16 units", async () => {
  useFakeClock();
  const session = await sessionWith(surrogateFlow);

  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toMatchObject([
    {
      params: {
        diagnostics: [
          {
            range: {
              start: { line: 7, character: 33 },
              end: { line: 7, character: 40 },
            },
          },
        ],
      },
    },
  ]);
});

test("a text that does not read pushes its syntax diagnostic", async () => {
  useFakeClock();
  const session = await sessionWith(unreadable);

  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  const syntax: unknown = expect.objectContaining({
    severity: 1,
    code: "syntax",
    source: "workflow",
  });
  expect(session.received).toMatchObject([
    { params: { uri, version: 1, diagnostics: [syntax] } },
  ]);
});

test("nothing is pushed after shutdown", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  await roundTrip(session);
  await session.client.sendRequest("shutdown");
  const late = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: flow }],
  };

  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    late,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await roundTrip(session);

  expect(session.received).toEqual([]);
});

test("a document reopened at its version is analysed anew", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  const closeFlow = { textDocument: { uri } };
  await session.client.sendNotification(
    DidCloseTextDocumentNotification.type,
    closeFlow,
  );
  const fixed = flow.replace("then: nowhere", "then: end");
  const reopened = {
    textDocument: { uri, languageId: "yaml", version: 1, text: fixed },
  };

  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    reopened,
  );
  await roundTrip(session);
  vi.advanceTimersByTime(200);
  await session.client.sendRequest("shutdown");

  expect(session.received).toEqual([
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [pushed] },
    },
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: [] },
    },
    {
      method: "textDocument/publishDiagnostics",
      params: { uri, version: 1, diagnostics: [] },
    },
  ]);
});
