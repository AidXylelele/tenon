import { Injectable } from "@nestjs/common";
import type { DeliveryEndpoint } from "../../../domain/automation/subscriptions/interfaces.js";
import type { EndpointBody } from "../schemas/subscription.schema.js";

@Injectable()
export class SubscriptionEndpointMapper {
  toEndpoint(body: EndpointBody): DeliveryEndpoint {
    const authentication = body.authentication;
    return {
      uri: body.uri,
      scheme: authentication?.scheme ?? null,
      secret: authentication?.secret ?? null,
    };
  }

  toBody(endpoint: DeliveryEndpoint): EndpointBody {
    if (endpoint.scheme === null || endpoint.secret === null)
      return { uri: endpoint.uri };

    const authentication = { scheme: endpoint.scheme, secret: endpoint.secret };
    return { uri: endpoint.uri, authentication };
  }
}
