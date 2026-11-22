import { expect, test } from "vitest";
import { CodeActionRequest } from "vscode-languageserver/browser";
import { useFakeClock } from "../support/clock.js";
import { inlineHeader } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const readsApiKey = `${inlineHeader}do:
  - a:
      set:
        x: \${ $secrets.apiKey }
`;

test("an undeclared secret is offered a quick fix that declares it", async () => {
  useFakeClock();
  const session = await sessionWith(readsApiKey);
  const onTheRead = {
    start: { line: 4, character: 11 },
    end: { line: 4, character: 11 },
  };
  const params = {
    textDocument: { uri },
    range: onTheRead,
    context: { diagnostics: [], only: ["quickfix"] },
  };

  const answered = await session.client.sendRequest(
    CodeActionRequest.type,
    params,
  );

  expect(answered).toMatchObject([
    {
      title: "Declare the secret 'apiKey'",
      kind: "quickfix",
      diagnostics: [{ code: "undeclared-secret" }],
      edit: {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: 5, character: 0 },
                end: { line: 5, character: 0 },
              },
              newText: "use:\n  secrets:\n    - apiKey\n",
            },
          ],
        },
      },
    },
  ]);
});
