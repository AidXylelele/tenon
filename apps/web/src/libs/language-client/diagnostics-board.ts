import type { LSPClient } from "@codemirror/lsp-client";
import type {
  Diagnostic,
  PublishDiagnosticsParams,
} from "vscode-languageserver-protocol";

const NONE: readonly Diagnostic[] = [];

export class DiagnosticsBoard {
  private readonly published = new Map<string, readonly Diagnostic[]>();
  private readonly listeners = new Set<() => void>();

  readonly receive = (
    _client: LSPClient,
    received: PublishDiagnosticsParams,
  ): boolean => {
    this.published.set(received.uri, received.diagnostics);

    for (const listener of this.listeners) listener();

    return false;
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  diagnosticsOf(uri: string): readonly Diagnostic[] {
    return this.published.get(uri) ?? NONE;
  }
}
