import { expect, test } from "vitest";
import {
  type CompletionList,
  type CompletionParams,
  CompletionRequest,
  RequestType,
} from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow, orderFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const completionListRequest = new RequestType<
  CompletionParams,
  CompletionList,
  void
>(CompletionRequest.method);

test("completion answers one list sharing its edit range", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri },
    position: { line: 25, character: 20 },
  };

  const answered = await session.client.sendRequest(
    CompletionRequest.type,
    params,
  );

  expect(answered).toEqual({
    isIncomplete: false,
    itemDefaults: {
      editRange: {
        start: { line: 25, character: 18 },
        end: { line: 25, character: 20 },
      },
    },
    items: [
      { label: "continue", kind: 14, textEditText: "continue" },
      { label: "exit", kind: 14, textEditText: "exit" },
      { label: "end", kind: 14, textEditText: "end" },
      { label: "greet", kind: 18, textEditText: "greet" },
      { label: "guard", kind: 18, textEditText: "guard" },
      { label: "route", kind: 18, textEditText: "route" },
    ],
  });
});

test("a member carries its description as Markdown", async () => {
  useFakeClock();
  const text = guardedFlow.replace(
    "        message: hello\n",
    "        message: hello\n      the\n",
  );
  const session = await sessionWith(text);
  const params = { textDocument: { uri }, position: { line: 9, character: 9 } };

  const answered = await session.client.sendRequest(
    completionListRequest,
    params,
  );

  expect(answered.items).toContainEqual({
    label: "then",
    kind: 10,
    textEditText: "then: ",
    documentation: {
      kind: "markdown",
      value: "The flow directive to be performed upon completion of the task.",
    },
  });
});

test("a name in scope inside an expression is a variable", async () => {
  useFakeClock();
  const session = await sessionWith(orderFlow);
  const params = {
    textDocument: { uri },
    position: { line: 9, character: 24 },
  };

  const answered = await session.client.sendRequest(
    completionListRequest,
    params,
  );

  expect(answered.items).toContainEqual({
    label: "$order",
    kind: 6,
    textEditText: "$order",
    documentation: { kind: "markdown", value: "loop item" },
  });
});
