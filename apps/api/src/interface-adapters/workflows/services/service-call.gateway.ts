import { Injectable } from '@nestjs/common';
import { ServiceCaller } from '../../../application/automation/instances/ports.js';
import { CallKind } from '../../../domain/automation/language/enums.js';
import type { ServiceCall } from '../../../domain/automation/language/interfaces.js';
import { CallMisconfigured } from '../../../domain/automation/language/results/call-misconfigured.js';
import type { ServiceResult } from '../../../domain/automation/language/results/service-result.js';
import { EndpointOutcomeKind, RequestPreparationKind } from './enums.js';
import { EndpointClient, type RequestPreparation } from './interfaces.js';
import { AuthorizationMapper } from './mappers/authorization.mapper.js';
import { HttpRequestMapper } from './mappers/http-request.mapper.js';
import { OpenApiRequestMapper } from './mappers/openapi-request.mapper.js';
import { ServiceResultMapper } from './mappers/service-result.mapper.js';

@Injectable()
export class ServiceCallGateway implements ServiceCaller {
  constructor(private readonly client: EndpointClient) {}

  async callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]> {
    const settled = await Promise.all(calls.map((call) => this.#call(call)));
    return settled.filter((result) => result !== null);
  }

  async #call(call: ServiceCall): Promise<ServiceResult | null> {
    if (call.kind === CallKind.Http) {
      const preparation = HttpRequestMapper.toPreparation(call);
      return this.#exchange(call, preparation);
    }

    const location = HttpRequestMapper.urlOf(call.endpoint.uri);

    if (location === null)
      return new CallMisconfigured(call.id, HttpRequestMapper.NOT_A_URI);

    const authorization = AuthorizationMapper.toAuthorization(
      call.endpoint.authentication,
    );
    const read = await this.client.read({ url: location, authorization });

    if (read.kind !== EndpointOutcomeKind.Read)
      return ServiceResultMapper.toFailure(call.id, read);

    const preparation = OpenApiRequestMapper.toPreparation(
      call,
      read.document,
      location,
    );
    return this.#exchange(call, preparation);
  }

  async #exchange(
    call: ServiceCall,
    preparation: RequestPreparation,
  ): Promise<ServiceResult | null> {
    if (preparation.kind === RequestPreparationKind.Misconfigured)
      return new CallMisconfigured(call.id, preparation.reason);

    const request = preparation.request;
    const authorization = AuthorizationMapper.ofCall(call);
    const outcome = await this.client.exchange({ request, authorization });
    return ServiceResultMapper.toResult(call, request, outcome);
  }
}
