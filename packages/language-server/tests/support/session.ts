import type { Analyzer, HostProfile } from "interpreter/front-end";
import { onTestFinished } from "vitest";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createProtocolConnection,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  type InitializeResult,
  type ProtocolConnection,
} from "vscode-languageserver/browser";
import { serve } from "../../src/lsp/index.js";
import * as support from "./analyzer.js";

interface ReceivedNotification {
  readonly method: string;
  readonly params: unknown;
}

export interface Session {
  readonly client: ProtocolConnection;
  readonly received: readonly ReceivedNotification[];
}

export const uri = "file:///flow.yaml";

export const initializeParams = {
  processId: null,
  rootUri: null,
  capabilities: {},
};

export function openSession(
  start: () => Promise<Analyzer> = () => support.analyzer,
): Session {
  const channel = new MessageChannel();
  serve(channel.port1, start);
  const reader = new BrowserMessageReader(channel.port2);
  const writer = new BrowserMessageWriter(channel.port2);
  const client = createProtocolConnection(reader, writer);
  const received: ReceivedNotification[] = [];
  const close = () => {
    client.dispose();
    channel.port1.close();
    channel.port2.close();
  };

  onTestFinished(close);
  client.onUnhandledNotification((message) => {
    const notification = { method: message.method, params: message.params };
    received.push(notification);
  });
  client.listen();

  return { client, received };
}

export async function sessionWith(text: string): Promise<Session> {
  const session = openSession();
  await initialized(session);
  const opened = {
    textDocument: { uri, languageId: "yaml", version: 1, text },
  };

  await session.client.sendNotification(
    DidOpenTextDocumentNotification.type,
    opened,
  );

  return session;
}

export function initialized(
  session: Session,
  profile: HostProfile = support.profile,
): Promise<InitializeResult> {
  const params = {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions: { profile },
  };

  return session.client.sendRequest(InitializeRequest.type, params);
}

export async function roundTrip(session: Session): Promise<void> {
  const refused = session.client.sendRequest("test/roundTrip");

  await Promise.allSettled([refused]);
}
