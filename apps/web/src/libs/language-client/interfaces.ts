import type {
  LSPClient,
  LSPClientConfig,
  LSPClientExtension,
} from "@codemirror/lsp-client";
import type { Extension } from "@codemirror/state";

export interface LanguageServerOptions {
  readonly initializationOptions: unknown;
  readonly extensions: readonly (Extension | LSPClientExtension)[];
  readonly notificationHandlers: NonNullable<
    LSPClientConfig["notificationHandlers"]
  >;
}

export interface LanguageConnection {
  readonly client: LSPClient;
  readonly close: () => void;
}

export type LanguageState =
  | { readonly kind: "starting" }
  | { readonly kind: "ready"; readonly connection: LanguageConnection }
  | { readonly kind: "failed"; readonly reason: string };
