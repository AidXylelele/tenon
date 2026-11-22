import { expect, test } from "vitest";
import { stepVariantsRequest } from "../../src/lsp/extensions/index.js";
import { profile } from "../support/analyzer.js";
import { initialized, openSession } from "../support/session.js";

const scriptAndShell = { ...profile, processes: ["script", "shell"] } as const;

test("the variants of a step the host runs are answered", async () => {
  const session = openSession();
  await initialized(session, scriptAndShell);

  const answered = await session.client.sendRequest(stepVariantsRequest);

  expect(answered).toEqual({
    variants: [
      "http",
      "openapi",
      "grpc",
      "asyncapi",
      "mcp",
      "a2a",
      "script-js",
      "script-python",
      "shell",
      "workflow",
      "do",
      "emit",
      "for",
      "fork",
      "listen",
      "raise",
      "set",
      "switch",
      "try",
      "wait",
    ],
  });
});

test("its result survives JSON", async () => {
  const session = openSession();
  await initialized(session);
  const answered = await session.client.sendRequest(stepVariantsRequest);

  const written = JSON.stringify(answered);
  const read: unknown = JSON.parse(written);

  expect(read).toEqual(answered);
});
