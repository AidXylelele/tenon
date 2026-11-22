import { expect, test } from "vitest";
import { HoverRequest } from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

test("hover on a label shows its step in Markdown over the label", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    textDocument: { uri },
    position: { line: 25, character: 20 },
  };

  const answered = await session.client.sendRequest(HoverRequest.type, params);

  expect(answered).toEqual({
    contents: { kind: "markdown", value: "**try** `guard`" },
    range: {
      start: { line: 25, character: 18 },
      end: { line: 25, character: 23 },
    },
  });
});
