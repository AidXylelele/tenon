import { expect, onTestFinished, test } from "vitest";
import {
  type HoverParams,
  InitializeRequest,
} from "vscode-languageserver/browser";
import { analyzer, profile } from "../support/analyzer.js";
import {
  initialized,
  initializeParams,
  openSession,
} from "../support/session.js";

const hoverParams: HoverParams = {
  textDocument: { uri: "file:///a.yaml" },
  position: { line: 0, character: 0 },
};

const lacksWithResolvers =
  "This browser lacks Promise.withResolvers; the editor needs Chrome 119, Firefox 121 or Safari 17.4 or later.";

const noOptions = initializeParams;

const listsANumber = {
  ...initializeParams,
  initializationOptions: { profile: { ...profile, grants: [1] } },
};

const countsTwoTriggers = {
  ...initializeParams,
  initializationOptions: { profile: { ...profile, triggers: "two" } },
};

const draftWithoutName = {
  ...initializeParams,
  initializationOptions: { profile, draft: { namespace: "sales" } },
};

async function removePromiseWithResolvers(): Promise<void> {
  await analyzer;
  const descriptor = Object.getOwnPropertyDescriptors(Promise).withResolvers;

  Reflect.deleteProperty(Promise, "withResolvers");
  onTestFinished(() => {
    Object.defineProperty(Promise, "withResolvers", descriptor);
  });
}

test.each([
  ["no options", noOptions],
  ["a member that lists a number", listsANumber],
  ["a trigger count it does not know", countsTwoTriggers],
  ["a draft with no name", draftWithoutName],
])("initialize refuses %s", async (_, params) => {
  const session = openSession();

  const refused = session.client.sendRequest(InitializeRequest.type, params);

  await expect(refused).rejects.toMatchObject({
    code: -32602,
    message:
      "The initialization options hold no host profile, or a draft that is not a namespace and a name.",
    data: { retry: false },
  });
});

test("an engine that fails to load fails initialize with no retry, and nothing is left unhandled", async () => {
  const unhandled: unknown[] = [];
  const collect = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", collect);
  onTestFinished(() => {
    process.off("unhandledRejection", collect);
  });
  const failing = Promise.reject(new Error("no engine"));
  const session = openSession(() => failing);

  const refused = initialized(session);
  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: "The language server could not start: no engine",
    data: { retry: false },
  });

  const shutDown = session.client.sendRequest("shutdown");
  await expect(shutDown).rejects.toMatchObject({ code: -32002 });

  expect(session.received).toEqual([
    {
      method: "window/logMessage",
      params: {
        type: 1,
        message: "The language server could not start: no engine",
      },
    },
  ]);
  expect(unhandled).toEqual([]);
});

test("after a failed start a request is not initialized", async () => {
  const failing = Promise.reject(new Error("no engine"));
  const session = openSession(() => failing);
  const initializing = initialized(session);
  await Promise.allSettled([initializing]);

  const refused = session.client.sendRequest("textDocument/hover", hoverParams);

  await expect(refused).rejects.toMatchObject({ code: -32002 });
});

test("a browser without Promise.withResolvers is refused at initialize with what it lacks and the browsers that have it", async () => {
  await removePromiseWithResolvers();
  const session = openSession();

  const refused = initialized(session);

  await expect(refused).rejects.toMatchObject({
    code: -32803,
    message: lacksWithResolvers,
    data: { retry: false },
  });
});

test("below the floor the engine is never started", async () => {
  await removePromiseWithResolvers();
  const starts: string[] = [];
  const start = () => {
    starts.push("engine");
    return analyzer;
  };
  const session = openSession(start);
  const initializing = initialized(session);
  await Promise.allSettled([initializing]);

  expect(starts).toEqual([]);
});
