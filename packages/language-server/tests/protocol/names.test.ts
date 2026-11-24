import { expect, test } from "vitest";
import {
  DefinitionRequest,
  ReferencesRequest,
  RenameRequest,
} from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const onLabel = {
  textDocument: { uri },
  position: { line: 25, character: 20 },
};

const guardKey = {
  start: { line: 9, character: 4 },
  end: { line: 9, character: 9 },
};

const guardLabel = {
  start: { line: 25, character: 18 },
  end: { line: 25, character: 23 },
};

test("a label goes to its step", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);

  const answered = await session.client.sendRequest(
    DefinitionRequest.type,
    onLabel,
  );

  expect(answered).toEqual({ uri, range: guardKey });
});

test("references hold the declaration when it is asked for", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { ...onLabel, context: { includeDeclaration: true } };

  const answered = await session.client.sendRequest(
    ReferencesRequest.type,
    params,
  );

  expect(answered).toEqual([
    { uri, range: guardKey },
    { uri, range: guardLabel },
  ]);
});

test("a rename changes the step and its label", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { ...onLabel, newName: "shield" };

  const answered = await session.client.sendRequest(RenameRequest.type, params);

  expect(answered).toEqual({
    changes: {
      [uri]: [
        { range: guardKey, newText: "shield" },
        { range: guardLabel, newText: "shield" },
      ],
    },
  });
});

test("a refused rename fails with its reason", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { ...onLabel, newName: "greet" };

  const refused = session.client.sendRequest(RenameRequest.type, params);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "A step named 'greet' already stands in this list.",
  });
});
