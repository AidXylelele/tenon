import { expect, test } from "vitest";
import { readTemplateRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { inlineHeader, unreadable } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const digestFlow = `${inlineHeader}do:
  - greet:
      set:
        message: 'New digest: \${ .title }'
        count: 3
`;

function paramsAt(pointer: string) {
  return { textDocument: { uri, version: 1 }, pointer };
}

test("a field that mixes text and data is read as a template", async () => {
  useFakeClock();
  const session = await sessionWith(digestFlow);
  const params = paramsAt("/do/0/greet/set/message");

  const answered = await session.client.sendRequest(
    readTemplateRequest,
    params,
  );

  expect(answered).toEqual({
    kind: "template",
    parts: [
      { kind: "text", text: "New digest: " },
      { kind: "data", expression: ".title", label: "title" },
    ],
  });
});

test("a field not written is a template with no part", async () => {
  useFakeClock();
  const session = await sessionWith(digestFlow);
  const params = paramsAt("/do/0/greet/set/subject");

  const answered = await session.client.sendRequest(
    readTemplateRequest,
    params,
  );

  expect(answered).toEqual({ kind: "template", parts: [] });
});

test("a field that holds no text is refused", async () => {
  useFakeClock();
  const session = await sessionWith(digestFlow);
  const params = paramsAt("/do/0/greet/set/count");

  const refused = session.client.sendRequest(readTemplateRequest, params);

  await expect(refused).rejects.toMatchObject({ code: -32803 });
});

test("a text that does not read is refused", async () => {
  useFakeClock();
  const session = await sessionWith(unreadable);
  const params = paramsAt("/do/0/greet/set/message");

  const refused = session.client.sendRequest(readTemplateRequest, params);

  await expect(refused).rejects.toMatchObject({ code: -32803 });
});

test("params with no pointer are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(digestFlow);
  const params = { textDocument: { uri, version: 1 } };

  const refused = session.client.sendRequest(
    readTemplateRequest.method,
    params,
  );

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});
