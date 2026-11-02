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
  // The media types whose content is deserialized (R16): JSON parsed, text as text; any
  // other content is base64, as the standard's HTTP response prescribes.
  static readonly #JSON_TYPE = /^application\/(?:[\w.+-]+\+)?json$/;
  static readonly #TEXT_TYPE =
    /^(?:text\/[\w.+-]+|application\/(?:[\w.+-]+\+)?(?:xml|yaml))$/;
  static readonly #NOT_JSON = 'The response content is not valid JSON';
  // PostgreSQL keeps no U+0000 in jsonb, so content holding one cannot be recorded. In JSON
  // text the character is the escape `\u0000` after an even number of backslashes.
  static readonly #NUL = /(?:^|[^\\])(?:\\\\)*\\u0000/;
  static readonly #HOLDS_NUL =
    'The response content holds a NUL character, which a value cannot hold';
  static readonly #AUTHORIZATION = 'authorization';
  static readonly #REDACTED = '[redacted]';

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
      case EndpointOutcomeKind.Invalid:
        return new CallMisconfigured(id, outcome.reason);
    }
  }

  static #responded(
    call: ServiceCall,
    request: HttpRequest,
    outcome: Responded,
  ): ServiceResult {
    const content = ServiceResultMapper.#contentOf(outcome);

    // A body that claims JSON and is not is an invalid response, a communication error.
    if (content === undefined)
      return new CommunicationFailed(call.id, ServiceResultMapper.#NOT_JSON);

    const text = JSON.stringify(content);

    if (ServiceResultMapper.#NUL.test(text))
      return new CommunicationFailed(call.id, ServiceResultMapper.#HOLDS_NUL);

    const body = outcome.body.toString('base64');
    const sent = outcome.authorization;
    const headers: Record<string, string> = {};

    // The described request lands in the task's output, which every user may read, so it
    // names the credentials it sent without their value.
    for (const name of Object.keys(request.headers)) {
      const credentials =
        name.toLowerCase() === ServiceResultMapper.#AUTHORIZATION;
      headers[name] = credentials
        ? ServiceResultMapper.#REDACTED
        : (request.headers[name] ?? '');
    }

    if (sent !== null)
      headers.authorization = `${sent.scheme} ${ServiceResultMapper.#REDACTED}`;

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

  // undefined: a JSON body that does not parse.
  static #contentOf(outcome: Responded): JsonValue | undefined {
    const declared = outcome.headers['content-type'] ?? '';
    const essence = declared.split(';')[0] ?? '';
    const type = essence.trim().toLowerCase();

    if (outcome.body.length === 0) return null;

    if (ServiceResultMapper.#TEXT_TYPE.test(type))
      return outcome.body.toString('utf8');

    if (!ServiceResultMapper.#JSON_TYPE.test(type))
      return outcome.body.toString('base64');

    try {
      return JSON.parse(outcome.body.toString('utf8')) as JsonValue;
    } catch {
      return undefined;
    }
  }

  static #authorizationOf(outcome: Responded): JsonObject | null {
    const sent = outcome.authorization;

    if (sent === null) return null;

    return { scheme: sent.scheme, parameter: sent.parameter };
  }
}
