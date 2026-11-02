import { Injectable } from '@nestjs/common';
import { ServiceCaller } from '../../../application/automation/instances/ports.js';
import { Clock } from '../../../application/automation/language/ports.js';
import { CallKind } from '../../../domain/automation/language/enums.js';
import type { ServiceCall } from '../../../domain/automation/language/interfaces.js';
import { CallMisconfigured } from '../../../domain/automation/language/results/call-misconfigured.js';
import type { ServiceResult } from '../../../domain/automation/language/results/service-result.js';
import { ServiceTimedOut } from '../../../domain/automation/language/results/service-timed-out.js';
import { EndpointOutcomeKind, RequestPreparationKind } from './enums.js';
import { EndpointClient, type RequestPreparation } from './interfaces.js';
import { AuthorizationMapper } from './mappers/authorization.mapper.js';
import { HttpRequestMapper } from './mappers/http-request.mapper.js';
import { OpenApiRequestMapper } from './mappers/openapi-request.mapper.js';
import { ServiceResultMapper } from './mappers/service-result.mapper.js';

@Injectable()
export class ServiceCallGateway implements ServiceCaller {
  constructor(
    private readonly client: EndpointClient,
    private readonly clock: Clock,
  ) {}

  async callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]> {
    const settled = await Promise.all(calls.map((call) => this.#call(call)));
    return settled.filter((result) => result !== null);
  }

  async #call(call: ServiceCall): Promise<ServiceResult | null> {
    const timeout = this.#timeoutOf(call);

    if (timeout !== null && timeout <= 0) return new ServiceTimedOut(call.id);

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
    const read = await this.client.read({
      url: location,
      authorization,
      timeout,
    });

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
    const timeout = this.#timeoutOf(call);

    if (timeout !== null && timeout <= 0) return new ServiceTimedOut(call.id);

    const outcome = await this.client.exchange({
      request,
      authorization,
      timeout,
    });
    const left = this.#timeoutOf(call);

    // An answer that arrives after the task's deadline is a time-out.
    if (left !== null && left < 0) return new ServiceTimedOut(call.id);

    return ServiceResultMapper.toResult(call, request, outcome);
  }

  #timeoutOf(call: ServiceCall): number | null {
    if (call.deadline === null) return null;

    const now = this.clock.now();
    return call.deadline.getTime() - now.getTime();
  }
}
