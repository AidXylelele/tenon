import { expect, test } from "vitest";
import { ResponseError } from "vscode-languageserver/browser";
import { Lifecycle } from "../../src/lsp/lifecycle.js";

test("a fault in a request answers InternalError and is logged", () => {
  const log: string[] = [];
  const lifecycle = new Lifecycle((line) => {
    log.push(line);
  });
  lifecycle.begin();
  lifecycle.run();
  const failing = lifecycle.guarded(() => {
    throw new Error("boom");
  });

  const answered = failing({});

  expect(answered).toBeInstanceOf(ResponseError);
  expect(answered).toMatchObject({
    code: -32603,
    message: "The request failed inside the language server.",
  });
  expect(log).toEqual([expect.stringMatching(/^Error: boom/)]);
});

test("a fault in a contained step is logged and goes no further", () => {
  const log: string[] = [];
  const lifecycle = new Lifecycle((line) => {
    log.push(line);
  });
  lifecycle.begin();
  lifecycle.run();
  const failing = lifecycle.contained(() => {
    throw new Error("boom");
  });

  const stepping = () => {
    failing({});
  };

  expect(stepping).not.toThrow();
  expect(log).toEqual([expect.stringMatching(/^Error: boom/)]);
});
