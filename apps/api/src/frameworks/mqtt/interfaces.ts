import type { IClientOptions } from "mqtt";
import type { z } from "zod";
import type { MQTT_OPERATION } from "./mqtt-binding.schema.js";

export type MqttVersion = NonNullable<IClientOptions["protocolVersion"]>;

export type MqttBinding = z.infer<typeof MQTT_OPERATION>;
