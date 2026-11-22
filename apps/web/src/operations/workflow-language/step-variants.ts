import type { LSPClient } from "@codemirror/lsp-client";
import { methods, type StepVariantsResult } from "language-server/protocol";

export function stepVariantsOf(client: LSPClient): Promise<StepVariantsResult> {
  return client.request<undefined, StepVariantsResult>(
    methods.stepVariants,
    undefined,
  );
}
