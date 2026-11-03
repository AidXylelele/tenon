import type { Specification } from '@openworkflowspec/sdk';
import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { EndpointOutcomeKind } from '../../../enums.js';
import type { EndpointClient } from '../../../interfaces.js';
import type { LeafKind, LeafResult } from '../../endings.js';
import type { Evaluator } from '../../evaluator.js';
import { ErrorKind, TaskFault } from '../../faults.js';
import type { Scope } from '../../scope.js';
import type { Authorizations } from './authorizations.js';
import { HttpRequests } from './http-requests.js';
import { HttpResponses } from './http-responses.js';
import { OpenApiRequests } from './openapi-requests.js';

// `call: openapi`: the operation the OpenAPI document describes, called with the task's
// parameters; the document and the operation may each need an authentication.
export class OpenApiCallKind implements LeafKind {
  constructor(
    private readonly endpoints: EndpointClient,
    private readonly authorizations: Authorizations,
    private readonly evaluator: Evaluator,
  ) {}

  async run(
    task: Specification.Task,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<LeafResult> {
    const call = ((task as Specification.CallOpenAPI).with ?? {}) as JsonObject;
    const resource = (call.document ?? {}) as JsonObject;
    const endpoint = resource.endpoint;
    const configured =
      typeof endpoint === 'object' &&
      endpoint !== null &&
      !Array.isArray(endpoint);
    const url = HttpRequests.textOf(configured ? endpoint.uri : endpoint);
    const documentAuthentication = configured
      ? endpoint.authentication
      : undefined;
    const readAuthorization = await this.authorizations.of(
      documentAuthentication,
      input,
      args,
      scope,
    );
    const read = await this.endpoints.read({
      url,
      authorization: readAuthorization,
      timeout: null,
    });

    if (read.kind !== EndpointOutcomeKind.Read)
      throw TaskFault.of(
        ErrorKind.Communication,
        scope.pointer,
        'The OpenAPI document could not be read',
      );

    const values = (await this.evaluator.template(
      call.parameters ?? {},
      input,
      args,
      scope.pointer,
    )) as JsonObject;
    const operationId = HttpRequests.textOf(call.operationId);
    const request = OpenApiRequests.of(
      read.document,
      url,
      operationId,
      values,
      scope,
    );
    const authorization = await this.authorizations.of(
      call.authentication,
      input,
      args,
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
    return { output, then: null };
  }
}
