import type { LSPClientConfig } from "@codemirror/lsp-client";
import type { Outcome } from "@/libs/data-access/problem";

export type FetchImport = (uri: string) => Promise<Outcome<string>>;

export type NotificationHandlers = NonNullable<
  LSPClientConfig["notificationHandlers"]
>;
