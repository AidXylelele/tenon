import type { LSPClient } from "@codemirror/lsp-client";
import { methods, type StepVariant } from "language-server/protocol";
import { describe, expect, it, vi } from "vitest";
import { stepVariantsOf } from "./step-variants";

describe("the variants of a step the host runs", () => {
  it("are_asked_of_the_language_server_with_no_params", async () => {
    const variants: readonly StepVariant[] = ["http", "set"];
    const request = vi.fn(() => Promise.resolve({ variants }));
    const client = { request } as unknown as LSPClient;

    const answered = await stepVariantsOf(client);

    expect(answered).toEqual({ variants });
    expect(request).toHaveBeenCalledWith(methods.stepVariants, undefined);
  });
});
