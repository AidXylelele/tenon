import type { AuthenticationScheme, HostProfile } from "./host-profile.js";
import type { JsonValue } from "./json.js";
import type { ResolvedAuthentication } from "./requests.js";

export interface SecretRefusal {
  readonly kind: "refused";
  readonly reason: string;
}

export interface SecretPolicies {
  authenticationOf(
    scheme: AuthenticationScheme,
    secret: JsonValue,
    profile: HostProfile,
  ): ResolvedAuthentication | SecretRefusal;
}
