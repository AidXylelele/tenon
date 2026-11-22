import type { AuthenticationScheme, HostProfile } from "../api/index.js";
import { isMemberOf } from "./is-member-of.js";

export const readModes = ["data", "envelope", "raw"] as const;
export type ReadMode = (typeof readModes)[number];

export const returnModes = ["stdout", "stderr", "code", "all", "none"] as const;
export type ReturnMode = (typeof returnModes)[number];

export const httpOutputModes = ["raw", "content", "response"] as const;
export type HttpOutputMode = (typeof httpOutputModes)[number];

export const expressionModes = ["strict", "loose"] as const;
export type ExpressionMode = (typeof expressionModes)[number];

export const backoffKinds = ["constant", "linear", "exponential"] as const;
export type BackoffKind = (typeof backoffKinds)[number];

export const consumptionKinds = ["all", "any", "one"] as const;
export type ConsumptionKind = (typeof consumptionKinds)[number];

export const pullPolicies = ["ifNotPresent", "always", "never"] as const;
export type PullPolicy = (typeof pullPolicies)[number];

export const cleanupPolicies = ["always", "never", "eventually"] as const;
export type CleanupPolicy = (typeof cleanupPolicies)[number];

export const oauth2Grants = [
  "authorization_code",
  "client_credentials",
  "password",
  "refresh_token",
  "urn:ietf:params:oauth:grant-type:token-exchange",
] as const;
export type OAuth2Grant = (typeof oauth2Grants)[number];

export const oauth2ClientAuthentications = [
  "client_secret_basic",
  "client_secret_post",
  "client_secret_jwt",
  "private_key_jwt",
  "none",
] as const;
export type OAuth2ClientAuthentication =
  (typeof oauth2ClientAuthentications)[number];

export const oauth2RequestEncodings = [
  "application/x-www-form-urlencoded",
  "application/json",
] as const;
export type OAuth2RequestEncoding = (typeof oauth2RequestEncodings)[number];

export const a2aMethods = [
  "message/send",
  "message/stream",
  "tasks/get",
  "tasks/list",
  "tasks/cancel",
  "tasks/resubscribe",
  "tasks/pushNotificationConfig/set",
  "tasks/pushNotificationConfig/get",
  "tasks/pushNotificationConfig/list",
  "tasks/pushNotificationConfig/delete",
  "agent/getAuthenticatedExtendedCard",
] as const;
export type A2aMethod = (typeof a2aMethods)[number];

export const a2aMessageMethods = [
  "message/send",
  "message/stream",
] as const satisfies readonly A2aMethod[];

export const mcpMethods = [
  "tools/list",
  "tools/call",
  "prompts/list",
  "prompts/get",
  "resources/list",
  "resources/read",
  "resources/templates/list",
] as const;
export type McpMethod = (typeof mcpMethods)[number];

export const asyncApiProtocols = [
  "amqp",
  "amqp1",
  "anypointmq",
  "googlepubsub",
  "http",
  "ibmmq",
  "jms",
  "kafka",
  "mercure",
  "mqtt",
  "mqtt5",
  "nats",
  "pulsar",
  "redis",
  "sns",
  "solace",
  "sqs",
  "stomp",
  "ws",
] as const;
export type AsyncApiProtocol = (typeof asyncApiProtocols)[number];

export const mcpTransports = [
  "http",
  "stdio",
] as const satisfies readonly HostProfile["mcpTransports"][number][];
export type McpTransportKind = (typeof mcpTransports)[number];

export const authenticationSchemes = [
  "basic",
  "bearer",
  "digest",
  "oauth2",
  "oidc",
] as const satisfies readonly AuthenticationScheme[];

export const eventAttributes = [
  "id",
  "source",
  "type",
  "time",
  "subject",
  "datacontenttype",
  "dataschema",
  "data",
] as const;
export type EventAttribute = (typeof eventAttributes)[number];

const eventPayloadMembers = ["data", "data_base64"] as const;
export type EventPayloadMember = (typeof eventPayloadMembers)[number];

export const uriEventAttributes = [
  "source",
  "dataschema",
] as const satisfies readonly EventAttribute[];
export type UriEventAttribute = (typeof uriEventAttributes)[number];

export const nonEmptyEventAttributes = [
  "id",
  "source",
  "type",
  "subject",
] as const satisfies readonly EventAttribute[];
export type NonEmptyEventAttribute = (typeof nonEmptyEventAttributes)[number];

export const defaultedEventAttributes = [
  "specversion",
  "id",
  "source",
  "time",
] as const;
export type DefaultedEventAttribute = (typeof defaultedEventAttributes)[number];

export const requiredEventAttributes = [
  "specversion",
  "id",
  "source",
  "type",
] as const;

export function isExtensionAttribute(name: string): boolean {
  const isProperty = isMemberOf(eventAttributes, name);
  const isRequired = isMemberOf(requiredEventAttributes, name);
  const isPayload = isMemberOf(eventPayloadMembers, name);

  return !isProperty && !isRequired && !isPayload;
}
