import { LSPClient } from "@codemirror/lsp-client";
import { describe, expect, it, vi } from "vitest";
import type { Diagnostic } from "vscode-languageserver-protocol";
import { DiagnosticsBoard } from "./diagnostics-board";

const client = new LSPClient();
const URI = "file:///sales/leads.yaml";
const problem: Diagnostic = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } },
  message: "Unknown key",
};

describe("the board of published diagnostics", () => {
  it("keeps_each_document's_latest_diagnostics_and_tells_its_readers", () => {
    const board = new DiagnosticsBoard();
    const reader = vi.fn();
    board.subscribe(reader);

    const handled = board.receive(client, { uri: URI, diagnostics: [problem] });
    const kept = board.diagnosticsOf(URI);

    expect(kept).toEqual([problem]);
    expect(reader).toHaveBeenCalledOnce();
    expect(handled).toBe(false);
  });

  it("a_document_without_diagnostics_reads_the_same_empty_list_each_time", () => {
    const board = new DiagnosticsBoard();
    const first = board.diagnosticsOf(URI);
    const second = board.diagnosticsOf(URI);

    expect(first).toEqual([]);
    expect(second).toBe(first);
  });

  it("a_reader_that_left_hears_nothing_more", () => {
    const board = new DiagnosticsBoard();
    const reader = vi.fn();
    const leave = board.subscribe(reader);

    leave();
    board.receive(client, { uri: URI, diagnostics: [] });

    expect(reader).not.toHaveBeenCalled();
  });
});
