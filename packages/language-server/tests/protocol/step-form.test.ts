import { expect, test } from "vitest";
import {
  stepFormRequest,
  workflowFormRequest,
} from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

test("a step's form gives each field its section", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 }, step: "/do/greet" };

  const answered = await session.client.sendRequest(stepFormRequest, params);
  const sections = answered.fields.map((field) => [field.key, field.section]);

  expect(answered).toMatchObject({
    version: 1,
    step: "/do/greet",
    failure: "stop",
    retry: null,
  });
  expect(sections).toEqual([
    ["if", "settings"],
    ["input", "data"],
    ["output", "data"],
    ["export", "data"],
    ["timeout", "failure"],
    ["then", "settings"],
    ["metadata", "note"],
    ["set", "settings"],
  ]);
});

test("an unknown step fails with its reason", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 }, step: "/do/nowhere" };

  const refused = session.client.sendRequest(stepFormRequest, params);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "No step has the id '/do/nowhere'.",
  });
});

test("params of another shape are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const unnamed = { textDocument: { uri, version: 1 } };

  const refused = session.client.sendRequest(stepFormRequest.method, unnamed);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 }, step: "/do/greet" };
  const answered = await session.client.sendRequest(stepFormRequest, params);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});

test("the workflow's form comes back with its version", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 } };

  const answered = await session.client.sendRequest(
    workflowFormRequest,
    params,
  );
  const pointers = answered.fields.map((field) => field.pointer);

  expect(answered.version).toBe(1);
  expect(pointers).toEqual([
    "/document/title",
    "/document/summary",
    "/document/version",
    "/schedule",
    "/input",
  ]);
});
