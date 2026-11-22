import type { GrpcRequest } from "../../../api/index.js";
import type { GrpcService, GrpcTemplate } from "../../../core/index.js";
import { authenticationOf } from "./authentications.js";
import { resourceOf } from "./endpoints.js";
import type { Building } from "./building.js";
import { entriesOf, optionalNumberOf } from "./shapes.js";

export function grpcRequestOf(
  grpc: GrpcTemplate,
  building: Building,
): GrpcRequest {
  const proto = resourceOf(grpc.proto, building);
  const methodArguments = entriesOf(grpc.arguments, building);
  const service = serviceOf(grpc.service, building);
  const authentication = authenticationOf(
    grpc.service.authentication,
    building,
  );

  return {
    kind: "grpc",
    proto,
    method: grpc.method,
    arguments: methodArguments,
    service,
    authentication,
  };
}

function serviceOf(
  service: GrpcService,
  building: Building,
): GrpcRequest["service"] {
  const port = optionalNumberOf(service.port, building);
  return { name: service.name, host: service.host, port };
}
