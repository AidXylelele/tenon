import type { IClientOptions } from "mqtt";

export type MqttVersion = NonNullable<IClientOptions["protocolVersion"]>;
