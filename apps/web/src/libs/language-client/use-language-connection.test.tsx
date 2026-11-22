import { LSPClient } from "@codemirror/lsp-client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LanguageConnection } from "./interfaces";
import { type Refusal, scriptedServer } from "./language-server.test-support";
import { useLanguageConnection } from "./use-language-connection";

interface ProbeProps {
  readonly connect: () => LanguageConnection;
}

const INITIALIZED = new Map([["initialize", { capabilities: {} }]]);

const NO_ANSWERS: ReadonlyMap<string, unknown> = new Map();

function Probe({ connect }: ProbeProps) {
  const state = useLanguageConnection(connect);
  const failed = state.kind === "failed";
  const shown = failed ? state.reason : state.kind;
  return <output>{shown}</output>;
}

function connectionTo(
  answers: ReadonlyMap<string, unknown>,
  refusals?: ReadonlyMap<string, Refusal>,
): LanguageConnection {
  const server = scriptedServer(answers, refusals);
  const client = new LSPClient().connect(server.transport);
  const close = vi.fn();
  return { client, close };
}

describe("a component connected to the language server", () => {
  it("it_is_ready_once_the_server_initializes", async () => {
    const connection = connectionTo(INITIALIZED);

    render(<Probe connect={() => connection} />);

    const ready = await screen.findByText("ready");
    expect(ready).toBeInTheDocument();
  });

  it("a_server_that_refuses_to_start_leaves_its_reason", async () => {
    const refusals = new Map([
      ["initialize", { code: -32603, message: "No workspace" }],
    ]);
    const connection = connectionTo(NO_ANSWERS, refusals);

    render(<Probe connect={() => connection} />);

    const reason = await screen.findByText("No workspace");
    expect(reason).toBeInTheDocument();
  });

  it("leaving_closes_the_connection", () => {
    const connection = connectionTo(INITIALIZED);
    const { unmount } = render(<Probe connect={() => connection} />);

    unmount();

    expect(connection.close).toHaveBeenCalledOnce();
  });
});
