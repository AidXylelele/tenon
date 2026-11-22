import { expect, test } from "vitest";
import { DidChangeTextDocumentNotification } from "vscode-languageserver/browser";
import { editRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const renameGuard = {
  textDocument: { uri, version: 1 },
  action: { kind: "renameStep", step: "/do/guard", name: "shield" },
} as const;

test("a rename answers its edits and the ids it changes", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);

  const answered = await session.client.sendRequest(editRequest, renameGuard);

  expect(answered).toEqual({
    edits: [
      {
        range: {
          start: { line: 9, character: 4 },
          end: { line: 9, character: 9 },
        },
        newText: "shield",
      },
      {
        range: {
          start: { line: 25, character: 18 },
          end: { line: 25, character: 23 },
        },
        newText: "shield",
      },
    ],
    ids: [
      { from: "/do/guard", to: "/do/shield" },
      { from: "/do/guard/try", to: "/do/shield/try" },
      { from: "/do/guard/try/fetch", to: "/do/shield/try/fetch" },
      { from: "/do/guard/catch/do", to: "/do/shield/catch/do" },
      { from: "/do/guard/catch/do/notify", to: "/do/shield/catch/do/notify" },
    ],
  });
});

test("an edit of an older version is content modified", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const change = {
    textDocument: { uri, version: 2 },
    contentChanges: [{ text: guardedFlow }],
  };
  await session.client.sendNotification(
    DidChangeTextDocumentNotification.type,
    change,
  );

  const refused = session.client.sendRequest(editRequest, renameGuard);

  await expect(refused).rejects.toMatchObject({ code: -32801 });
});

test("a refused edit fails with its reason", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: { kind: "removeStep", step: "/do/nowhere" },
  } as const;

  const refused = session.client.sendRequest(editRequest, params);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "No step with the id /do/nowhere stands in the text.",
  });
});

test("an action of another shape is invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: { kind: "insertStep", list: "/do", index: 0, step: "sleep" },
  };

  const refused = session.client.sendRequest(editRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const answered = await session.client.sendRequest(editRequest, renameGuard);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});

test("a failure choice answers its edit and the ids it moves", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: {
      kind: "setFailure",
      step: "/do/greet",
      failure: { kind: "continue" },
    },
  } as const;

  const answered = await session.client.sendRequest(editRequest, params);

  expect(answered.ids).toEqual([
    { from: "/do/greet", to: "/do/greet/try/greet" },
  ]);
});

test("a retry with no attempts is invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: {
      kind: "setFailure",
      step: "/do/greet",
      failure: { kind: "retry", seconds: 5, growing: false },
    },
  };

  const refused = session.client.sendRequest(editRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("a step on a branch answers the edits that place it", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: {
      kind: "insertStepOnBranch",
      switch: "/do/route",
      case: "done",
      step: "wait",
      name: null,
    },
  } as const;

  const answered = await session.client.sendRequest(editRequest, params);

  expect(answered).toEqual({
    edits: [
      {
        range: {
          start: { line: 27, character: 17 },
          end: { line: 27, character: 21 },
        },
        newText: " wait",
      },
      {
        range: {
          start: { line: 28, character: 0 },
          end: { line: 28, character: 0 },
        },
        newText: "  - wait:\n      wait: PT30M\n      then: end\n",
      },
    ],
    ids: [],
  });
});

test("a step on a branch that names no case is invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri, version: 1 },
    action: {
      kind: "insertStepOnBranch",
      switch: "/do/route",
      step: "wait",
      name: null,
    },
  };

  const refused = session.client.sendRequest(editRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});
