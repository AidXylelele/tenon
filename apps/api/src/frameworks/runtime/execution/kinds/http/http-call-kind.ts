import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import type { EndpointClient } from '../../../interfaces.js';
import type { LeafKind, LeafResult } from '../../endings.js';
import type { Evaluator } from '../../evaluator.js';
import type { Scope } from '../../scope.js';
import { Authorizations } from './authorizations.js';
import { HttpRequests } from './http-requests.js';
import { HttpResponses } from './http-responses.js';

// `call: http`: one request to the endpoint, through the client that refuses private addresses
// and bounds its time and its response (FR-022).
export class HttpCallKind implements LeafKind {
  readonly #requests: HttpRequests;

  constructor(
    private readonly endpoints: EndpointClient,
    private readonly authorizations: Authorizations,
    evaluator: Evaluator,
  ) {
    this.#requests = new HttpRequests(evaluator);
  }

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const call = ((task as Specification.CallHTTP).with ?? {}) as JsonObject;
    const endpoint = call.endpoint;
    const configured =
      typeof endpoint === 'object' &&
      endpoint !== null &&
      !Array.isArray(endpoint);
    const uri = HttpRequests.textOf(configured ? endpoint.uri : endpoint);
    const declared = configured ? endpoint.authentication : undefined;
    const authorization = await this.authorizations.of(
      declared,
      input,
      args,
      scope,
    );
    const definitionArgs = Authorizations.argumentsWith(args, authorization);
    const request = await this.#requests.of(
      call.method,
      uri,
      call,
      input,
      definitionArgs,
      scope,
    );
    const outcome = await this.endpoints.exchange({
      request,
      authorization,
      timeout: null,
    });
    const format = HttpRequests.textOf(call.output ?? 'content');
    const redirect = call.redirect === true;
    const output = HttpResponses.outputOf(
      outcome,
      request,
      format,
      redirect,
      scope,
    );
    const sent = Authorizations.sentBy(outcome);
    return { output, then: null, authorization: sent };
  }
}
