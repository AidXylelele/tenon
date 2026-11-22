import { expect, test } from "vitest";
import { DidChangeTextDocumentNotification } from "vscode-languageserver/browser";
import { structureRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { type Session, sessionWith, uri } from "../support/session.js";

const atVersion1 = { textDocument: { uri }, version: 1 };

async function changedTo(session: Session, text: string): Promise<void> {
  const change = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text }],
  };

  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    change,
  );
}

test("the structure of a version holds its steps in LSP ranges", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 } };

  const answered = await session.client.sendRequest(structureRequest, params);

  expect(answered).toMatchObject({
    version: 1,
    stale: false,
    workflow: {
      namespace: "test",
      name: "flow",
      steps: {
        id: "/do",
        steps: [
          {
            id: "/do/greet",
            range: {
              start: { line: 6, character: 2 },
              end: { line: 8, character: 22 },
            },
            selectionRange: {
              start: { line: 6, character: 4 },
              end: { line: 6, character: 9 },
            },
          },
          { id: "/do/guard" },
          { id: "/do/route" },
        ],
      },
    },
  });
});

test("another version is content modified", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  await changedTo(session, guardedFlow);
  const params = { textDocument: { uri, version: 1 } };

  const refused = session.client.sendRequest(structureRequest, params);

  await expect(refused).rejects.toMatchObject({ code: -32801 });
});

test("params of another shape are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);

  const refused = session.client.sendRequest(
    structureRequest.method,
    atVersion1,
  );

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 } };
  const answered = await session.client.sendRequest(structureRequest, params);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
