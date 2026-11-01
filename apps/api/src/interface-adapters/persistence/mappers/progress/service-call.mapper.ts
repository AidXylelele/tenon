import type { ServiceCall } from '../../../../domain/automation/language/interfaces.js';
import type { ServiceCallState } from '../../interfaces.js';
import { ServiceAuthenticationMapper } from './service-authentication.mapper.js';

export class ServiceCallMapper {
  static toState(call: ServiceCall | null): ServiceCallState | null {
    if (call === null) return null;

    const endpointAuthentication = ServiceAuthenticationMapper.toState(
      call.endpoint.authentication,
    );
    const authentication = ServiceAuthenticationMapper.toState(
      call.authentication,
    );
    return {
      id: call.id,
      kind: call.kind,
      endpoint: {
        uri: call.endpoint.uri,
        authentication: endpointAuthentication,
      },
      arguments: call.arguments,
      authentication,
      input: call.input,
    };
  }

  static toDomain(state: ServiceCallState | null): ServiceCall | null {
    if (state === null) return null;

    const endpointAuthentication = ServiceAuthenticationMapper.toDomain(
      state.endpoint.authentication,
    );
    const authentication = ServiceAuthenticationMapper.toDomain(
      state.authentication,
    );
    return {
      id: state.id,
      kind: state.kind,
      endpoint: {
        uri: state.endpoint.uri,
        authentication: endpointAuthentication,
      },
      arguments: state.arguments,
      authentication,
      input: state.input,
    };
  }
}
