import type { ServiceAuthentication } from '../../../../domain/automation/language/interfaces.js';
import type { ServiceAuthenticationState } from '../../interfaces.js';

export class ServiceAuthenticationMapper {
  static toState(
    authentication: ServiceAuthentication | null,
  ): ServiceAuthenticationState | null {
    if (authentication === null) return null;

    return {
      scheme: authentication.scheme,
      settings: authentication.settings,
    };
  }

  static toDomain(
    state: ServiceAuthenticationState | null,
  ): ServiceAuthentication | null {
    if (state === null) return null;

    return { scheme: state.scheme, settings: state.settings };
  }
}
