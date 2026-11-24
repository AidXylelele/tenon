import type { ConnectionOptions as TlsConnection } from "node:tls";
import type { NodeConnectionOptions } from "@nats-io/transport-node";

export type NatsTls = NonNullable<NodeConnectionOptions["tls"]> &
  Pick<TlsConnection, "servername">;
