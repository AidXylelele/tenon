import { expect, test } from "vitest";
import { dataAtRequest } from "../../src/lsp/extensions/index.js";
import { useFakeClock } from "../support/clock.js";
import { guardedFlow } from "../support/documents.js";
import { sessionWith, uri } from "../support/session.js";

const atRoute = {
  textDocument: { uri, version: 1 },
  step: "/do/route",
  field: "/do/2/route/switch/0/again/when",
};

test("the data at a step's field is answered with the expressions to insert", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);

  const answered = await session.client.sendRequest(dataAtRequest, atRoute);
  const entries = answered.entries.map((entry) => [
    entry.source,
    entry.name,
    entry.expression,
  ]);

  expect(answered).toMatchObject({
    version: 1,
    written: [{ expression: ".retry", label: ["guard", "retry"] }],
    warnings: [{ kind: "contextNotKnownObject" }],
  });
  expect(entries).toEqual([
    ["step", "guard", "."],
    ["step", "greet", "$context.greet"],
    ["workflowInput", "input", "$workflow.input"],
    ["time", "now", "now | todate"],
    ["time", "today", 'now | strftime("%Y-%m-%dT00:00:00Z")'],
    ["time", "yesterday", 'now - 86400 | strftime("%Y-%m-%dT00:00:00Z")'],
  ]);
});

test("a field outside the step fails with its reason", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { ...atRoute, field: "/do/0/greet/set/message" };

  const refused = session.client.sendRequest(dataAtRequest, params);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "/do/0/greet/set/message is not a field of the step /do/route.",
  });
});

test("the last test run's samples and a typed field name come back as members with their expressions", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = {
    ...atRoute,
    samples: { "/do/guard": { status: 200 } },
    typed: "body.id",
  };

  const answered = await session.client.sendRequest(dataAtRequest, params);
  const steps = answered.entries.filter((entry) => entry.source === "step");
  const fields = steps.map((entry) => [
    entry.name,
    entry.members.map((member) => member.expression),
    entry.typed?.expression ?? null,
  ]);

  expect(fields).toEqual([
    ["guard", [".status"], ".body.id"],
    ["greet", ["$context.greet.message"], "$context.greet.body.id"],
  ]);
});

test.each([
  ["samples that are not an object", { samples: [1] }],
  ["a typed name that is not text", { typed: 1 }],
])("params with %s are invalid", async (_, wrong) => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { ...atRoute, ...wrong };

  const refused = session.client.sendRequest(dataAtRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("params with no field are invalid", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const params = { textDocument: { uri, version: 1 }, step: "/do/route" };

  const refused = session.client.sendRequest(dataAtRequest.method, params);

  await expect(refused).rejects.toMatchObject({ code: -32602 });
});

test("its result survives JSON", async () => {
  useFakeClock();
  const session = await sessionWith(guardedFlow);
  const answered = await session.client.sendRequest(dataAtRequest, atRoute);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
