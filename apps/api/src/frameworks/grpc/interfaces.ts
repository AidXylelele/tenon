import type { Client } from "@grpc/grpc-js";

export interface ServiceAddress {
  readonly target: string;
  readonly host: string;
  readonly port: number;
  readonly plaintext: boolean;
}

export interface ServiceChannel {
  readonly client: Client;
  readonly plaintext: boolean;
}
