import type {
  JsonObject,
  JsonValue,
  ServiceCall,
} from '../../../../domain/automation/language/interfaces.js';
import { AuthenticationFailed } from '../../../../domain/automation/language/results/authentication-failed.js';
import { CallMisconfigured } from '../../../../domain/automation/language/results/call-misconfigured.js';
import { CommunicationFailed } from '../../../../domain/automation/language/results/communication-failed.js';
import { ServiceResponded } from '../../../../domain/automation/language/results/service-responded.js';
import type { ServiceResult } from '../../../../domain/automation/language/results/service-result.js';
import { ServiceTimedOut } from '../../../../domain/automation/language/results/service-timed-out.js';
import { EndpointOutcomeKind } from '../enums.js';
import type {
  DocumentOutcome,
  ExchangeOutcome,
  HttpRequest,
  Responded,
} from '../interfaces.js';

export class ServiceResultMapper {
  static readonly #UNREADABLE = 'The OpenAPI document could not be read';
  static readonly #JSON = 'json';

  static toResult(
    call: ServiceCall,
    request: HttpRequest,
    outcome: ExchangeOutcome,
  ): ServiceResult | null {
    if (outcome.kind === EndpointOutcomeKind.Responded)
      return ServiceResultMapper.#responded(call, request, outcome);

    return ServiceResultMapper.toFailure(call.id, outcome);
  }

  static toFailure(
    id: string,
    outcome: Exclude<DocumentOutcome, { kind: EndpointOutcomeKind.Read }>,
  ): ServiceResult | null {
    switch (outcome.kind) {
      case EndpointOutcomeKind.Rejected:
        return null;
      case EndpointOutcomeKind.TimedOut:
        return new ServiceTimedOut(id);
      case EndpointOutcomeKind.Unreachable:
        return new CommunicationFailed(id, outcome.reason);
      case EndpointOutcomeKind.Unauthorized:
        return new AuthenticationFailed(id, outcome.reason);
      case EndpointOutcomeKind.Unreadable:
        return new CallMisconfigured(id, ServiceResultMapper.#UNREADABLE);
    }
  }

  static #responded(
    call: ServiceCall,
    request: HttpRequest,
    outcome: Responded,
  ): ServiceResult {
    const content = ServiceResultMapper.#contentOf(outcome);
    const body = outcome.body.toString('base64');
    const sent = outcome.authorization;
    const headers: Record<string, string> = {};

    for (const name of Object.keys(request.headers))
      headers[name] = request.headers[name] ?? '';

    if (sent !== null)
      headers.authorization = `${sent.scheme} ${sent.parameter}`;

    const described: JsonObject = {
      method: request.method,
      uri: request.url,
      headers,
    };
    const authorization = ServiceResultMapper.#authorizationOf(outcome);
    return new ServiceResponded({
      id: call.id,
      status: outcome.status,
      headers: outcome.headers,
      content,
      body,
      request: described,
      authorization,
    });
  }

  static #contentOf(outcome: Responded): JsonValue {
    const type = outcome.headers['content-type'] ?? '';
    const text = outcome.body.toString('utf8');

    if (!type.includes(ServiceResultMapper.#JSON) || text === '') return text;

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  static #authorizationOf(outcome: Responded): JsonObject | null {
    const sent = outcome.authorization;

    if (sent === null) return null;

    return { scheme: sent.scheme, parameter: sent.parameter };
  }
}
