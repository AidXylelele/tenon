import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse,
} from "node:http";
import { createServer as createTlsServer } from "node:https";
import type { AddressInfo } from "node:net";

export interface ReceivedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

type StubHandler = (request: ReceivedRequest, response: ServerResponse) => void;

export interface StubServer {
  readonly origin: string;
  readonly port: number;
  readonly received: ReceivedRequest[];
  close(): Promise<void>;
}

interface StubCertificate {
  readonly cert: string;
  readonly key: string;
}

export async function startStubServer(
  handler: StubHandler,
  certificate: StubCertificate | null = null,
): Promise<StubServer> {
  const received: ReceivedRequest[] = [];
  const listener: RequestListener = (incoming, response) => {
    void bodyOf(incoming).then((body) => {
      const request = {
        method: incoming.method ?? "",
        url: incoming.url ?? "",
        headers: incoming.headers,
        body,
      };
      received.push(request);
      handler(request, response);
    });
  };
  const server: Server =
    certificate === null
      ? createServer(listener)
      : createTlsServer(certificate, listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const scheme = certificate === null ? "http" : "https";
  return {
    origin: `${scheme}://127.0.0.1:${String(port)}`,
    port,
    received,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function bodyOf(incoming: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of incoming) chunks.push(chunk as Buffer);

  return Buffer.concat(chunks).toString("utf8");
}
