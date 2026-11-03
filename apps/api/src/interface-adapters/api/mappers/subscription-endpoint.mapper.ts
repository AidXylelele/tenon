import type { DeliveryEndpoint } from '../../../domain/automation/subscriptions/interfaces.js';
import type { CreateSubscriptionBody } from '../schemas/subscription.schemas.js';

type EndpointBody = CreateSubscriptionBody['endpoint'];

// A subscription's endpoint in the standard's form (a URI and an authentication taken from a
// secret) as the domain keeps it, and back.
export class SubscriptionEndpointMapper {
  static toEndpoint(body: EndpointBody): DeliveryEndpoint {
    const authentication = body.authentication;
    return {
      uri: body.uri,
      scheme: authentication?.scheme ?? null,
      secret: authentication?.secret ?? null,
    };
  }

  static toBody(endpoint: DeliveryEndpoint): EndpointBody {
    if (endpoint.scheme === null || endpoint.secret === null)
      return { uri: endpoint.uri };

    return {
      uri: endpoint.uri,
      authentication: { scheme: endpoint.scheme, secret: endpoint.secret },
    };
  }
}
