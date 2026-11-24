import type { LSPClient } from "@codemirror/lsp-client";
import {
  type DidFetchImportsParams,
  type ImportsNeededParams,
  methods,
} from "language-server/protocol";
import { reasonOf } from "@/libs/language-client/failures";
import type { FetchImport, NotificationHandlers } from "./interfaces";

export function fetchingImports(
  fetchImport: FetchImport,
): NotificationHandlers {
  return {
    [methods.importsNeeded]: (
      client: LSPClient,
      needed: ImportsNeededParams,
    ): boolean => {
      void sendFetched(client, needed, fetchImport);
      return true;
    },
  };
}

async function sendFetched(
  client: LSPClient,
  needed: ImportsNeededParams,
  fetchImport: FetchImport,
): Promise<void> {
  const settled = await Promise.allSettled(
    needed.imports.map((each) => fetchImport(each.uri)),
  );
  const texts: Record<string, string> = {};
  const failures: Record<string, string> = {};

  needed.imports.forEach((each, index) => {
    const answer = settled[index];

    if (answer === undefined) return;

    if (answer.status === "rejected") {
      failures[each.reference] = reasonOf(answer.reason);
      return;
    }

    const outcome = answer.value;

    if (outcome.ok) texts[each.reference] = outcome.value;
    else failures[each.reference] = outcome.problem.detail;
  });

  const params = { textDocument: needed.textDocument, texts, failures };
  client.notification<DidFetchImportsParams>(methods.didFetchImports, params);
}
