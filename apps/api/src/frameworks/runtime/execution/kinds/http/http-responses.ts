import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { EndpointOutcomeKind } from '../../../enums.js';
import type {
  EndpointResponded,
  ExchangeOutcome,
  HttpRequest,
} from '../../../interfaces.js';
import { CapacityExhaustedError, ErrorKind, TaskFault } from '../../faults.js';
import type { Scope } from '../../scope.js';

// What a call's response gives the task: its content (JSON parsed, text as text, anything else
// in base64), the whole response, or the raw body; a status from 400, or a redirection the call
// does not accept, is a communication error with that status.
export class HttpResponses {
  static readonly #JSON_TYPE = /^application\/(?:[\w.+-]+\+)?json$/;
  static readonly #TEXT_TYPE =
    /^(?:text\/[\w.+-]+|application\/(?:[\w.+-]+\+)?(?:xml|yaml))$/;
  static readonly #REDIRECTION_FROM = 300;
  static readonly #ERROR_FROM = 400;
  static readonly #REDACTED = '[redacted]';

  static outputOf(
    outcome: ExchangeOutcome,
    request: HttpRequest,
    format: string,
    redirect: boolean,
    scope: Scope,
  ): JsonValue {
    if (outcome.kind !== EndpointOutcomeKind.Responded)
      throw HttpResponses.#failureOf(outcome, scope);

    const status = outcome.status;
    const failed = status >= HttpResponses.#ERROR_FROM;
    const redirected = status >= HttpResponses.#REDIRECTION_FROM && !failed;

    if (failed || (redirected && !redirect))
      throw TaskFault.of(
        ErrorKind.Communication,
        scope.pointer,
        `The service answered with status ${String(status)}`,
        status,
      );

    const content = HttpResponses.#contentOf(outcome, scope);

    if (format === 'raw') return outcome.body.toString('base64');

    if (format !== 'response') return content;

    return {
      request: HttpResponses.#described(request, outcome),
      statusCode: status,
      headers: outcome.headers as JsonObject,
      content,
    };
  }

  static #failureOf(
    outcome: Exclude<ExchangeOutcome, EndpointResponded>,
    scope: Scope,
  ): Error {
    const at = scope.pointer;

    switch (outcome.kind) {
      case EndpointOutcomeKind.Rejected:
        return new CapacityExhaustedError();
      case EndpointOutcomeKind.TimedOut:
        return TaskFault.of(
          ErrorKind.Timeout,
          at,
          'The service did not answer in time',
        );
      case EndpointOutcomeKind.Unreachable:
        return TaskFault.of(ErrorKind.Communication, at, outcome.reason);
      case EndpointOutcomeKind.Unauthorized:
        return TaskFault.of(ErrorKind.Authentication, at, outcome.reason);
      case EndpointOutcomeKind.Invalid:
        return TaskFault.of(ErrorKind.Configuration, at, outcome.reason);
    }
  }

  static #contentOf(outcome: EndpointResponded, scope: Scope): JsonValue {
    const declared = outcome.headers['content-type'] ?? '';
    const type = (declared.split(';')[0] ?? '').trim().toLowerCase();

    if (outcome.body.length === 0) return null;

    if (HttpResponses.#TEXT_TYPE.test(type))
      return outcome.body.toString('utf8');

    if (!HttpResponses.#JSON_TYPE.test(type))
      return outcome.body.toString('base64');

    try {
      return JSON.parse(outcome.body.toString('utf8')) as JsonValue;
    } catch {
      throw TaskFault.of(
        ErrorKind.Communication,
        scope.pointer,
        'The response content is not valid JSON',
      );
    }
  }

  // The request as the output shows it, which every user may read: credentials are named,
  // never given.
  static #described(
    request: HttpRequest,
    outcome: EndpointResponded,
  ): JsonObject {
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(request.headers))
      headers[name] =
        name.toLowerCase() === 'authorization'
          ? HttpResponses.#REDACTED
          : value;

    const sent = outcome.authorization;

    if (sent !== null)
      headers.authorization = `${sent.scheme} ${HttpResponses.#REDACTED}`;

    return { method: request.method, uri: request.url, headers };
  }
}
