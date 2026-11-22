import { expect, test } from "vitest";
import { DidChangeTextDocumentNotification } from "vscode-languageserver/browser";
import { rangesOfRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { flow, surrogateFlow, unreadable } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const pointers = ["/do/0/route/switch/0/known/then", "/do/0/route/nowhere"];

const atVersion1 = { textDocument: { uri, version: 1 }, pointers };

test("pointers come back as ranges of the version", async () => {
  useFakeClock();
  const session = await sessionWith(flow);

  const answered = await session.client.sendRequest(
    rangesOfRequest,
    atVersion1,
  );

  expect(answered).toEqual({
    version: 1,
    ranges: [
      { start: { line: 10, character: 18 }, end: { line: 10, character: 25 } },
      { start: { line: 7, character: 6 }, end: { line: 13, character: 0 } },
    ],
  });
});

test("a pointer after a surrogate pair is placed in UTF-16 units", async () => {
  useFakeClock();
  const session = await sessionWith(surrogateFlow);
  const afterPair = {
    textDocument: { uri, version: 1 },
    pointers: ["/do/0/a/then"],
  };

  const answered = await session.client.sendRequest(rangesOfRequest, afterPair);

  expect(answered).toEqual({
    version: 1,
    ranges: [
      { start: { line: 7, character: 33 }, end: { line: 7, character: 40 } },
    ],
  });
});

test("another version is content modified", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  const changed = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: flow }],
  };
  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    changed,
  );

  const refused = session.client.sendRequest(rangesOfRequest, atVersion1);

  await expect(refused).rejects.toMatchObject({ code: -32801 });
});

test("params of another shape are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  const unlisted = { textDocument: { uri, version: 1 }, pointers: "/do" };

  const refused = session.client.sendRequest(rangesOfRequest.method, unlisted);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(flow);
  const answered = await session.client.sendRequest(
    rangesOfRequest,
    atVersion1,
  );

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});

test("a text that does not read places no range", async () => {
  useFakeClock();
  const session = await sessionWith(unreadable);

  const answered = await session.client.sendRequest(
    rangesOfRequest,
    atVersion1,
  );

  expect(answered).toEqual({ version: 1, ranges: [null, null] });
});
