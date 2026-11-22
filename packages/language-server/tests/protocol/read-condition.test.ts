import { expect, test } from "vitest";
import { readConditionRequest } from "../../src/lsp/extensions/index.js";
import { initialized, openSession } from "../support/session.js";

test("a condition in its one form is read as rows", async () => {
  const session = openSession();
  await initialized(session);
  const params = {
    text: '${ .items | . != null and . != "" and . != [] and . != {} }',
  };

  const answered = await session.client.sendRequest(
    readConditionRequest,
    params,
  );

  expect(answered).toEqual({
    kind: "condition",
    condition: {
      join: "all",
      rows: [{ left: ".items", comparison: "isNotEmpty", right: null }],
    },
  });
});

test("params with no text are invalid", async () => {
  const session = openSession();
  await initialized(session);

  const refused = session.client.sendRequest(readConditionRequest.method, {});

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  const session = openSession();
  await initialized(session);
  const params = { text: '${ .status == "paid" }' };
  const answered = await session.client.sendRequest(
    readConditionRequest,
    params,
  );

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
