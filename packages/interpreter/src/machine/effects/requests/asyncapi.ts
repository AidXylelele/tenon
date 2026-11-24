import type { AsyncApiMessage, AsyncApiRequest } from "../../../api/index.js";
import type {
  AsyncApiProtocolChoice,
  AsyncApiPublishTemplate,
  AsyncApiRequestTemplate,
  AsyncApiServerTemplate,
  AsyncApiTarget,
} from "../../../core/index.js";
import { authenticationOf } from "./authentications.js";
import { resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";
import { entriesOf, valueOf } from "./shapes.js";

interface TargetNames {
  readonly operation: string | null;
  readonly channel: string | null;
}

type Exchange = AsyncApiRequest["exchange"];

type Call = Omit<AsyncApiRequest, "kind" | "exchange">;

export type Receiving = Omit<
  Extract<Exchange, { readonly kind: "receive" }>,
  "kind"
>;

export function publishRequestOf(
  publish: AsyncApiPublishTemplate,
  building: Building,
): AsyncApiRequest {
  const call = callOf(publish, building);
  const message = publishedMessageOf(publish, building);
  const exchange: Exchange = { kind: "publish", message };

  return asyncApiRequestOf(call, exchange);
}

export function receiveRequestOf(
  request: AsyncApiRequestTemplate,
  building: Building,
  receiving: Receiving,
): AsyncApiRequest {
  const call = callOf(request, building);
  const exchange: Exchange = {
    kind: "receive",
    subscription: receiving.subscription,
    position: receiving.position,
    closesAt: receiving.closesAt,
  };

  return asyncApiRequestOf(call, exchange);
}

function callOf(request: AsyncApiRequestTemplate, building: Building): Call {
  const document = resourceOf(request.document, building);
  const authentication = authenticationOf(request.authentication, building);
  const target = targetNamesOf(request.target);
  const server = serverOf(request.server, building);
  const protocol = protocolOf(request.protocol);

  return {
    document,
    authentication,
    operation: target.operation,
    channel: target.channel,
    server,
    protocol,
  };
}

function asyncApiRequestOf(call: Call, exchange: Exchange): AsyncApiRequest {
  return {
    kind: "asyncapi",
    document: call.document,
    authentication: call.authentication,
    operation: call.operation,
    channel: call.channel,
    server: call.server,
    protocol: call.protocol,
    exchange,
  };
}

function publishedMessageOf(
  publish: AsyncApiPublishTemplate,
  building: Building,
): AsyncApiMessage {
  const payload = valueOf(publish.payload, building);
  const headers = entriesOf(publish.headers, building);

  return { payload, headers };
}

function targetNamesOf(target: AsyncApiTarget): TargetNames {
  switch (target.kind) {
    case "operation":
      return { operation: target.operation, channel: null };
    case "channel":
      return { operation: null, channel: target.channel };
  }
}

function serverOf(
  server: AsyncApiServerTemplate,
  building: Building,
): AsyncApiRequest["server"] {
  switch (server.kind) {
    case "default":
      return null;
    case "named": {
      const variables = entriesOf(server.variables, building);
      return { name: server.name, variables };
    }
  }
}

function protocolOf(protocol: AsyncApiProtocolChoice): string | null {
  switch (protocol.kind) {
    case "default":
      return null;
    case "named":
      return protocol.protocol;
  }
}
