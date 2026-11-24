import type {
  AuthenticationScheme,
  HostProfile,
  JsonValue,
  ResolvedAuthentication,
  SecretPolicies,
  SecretRefusal,
} from "../../api/index.js";
import {
  isJsonObject,
  type SchemaReferences,
  type Validator,
} from "../../runtime/index.js";
import { heldAuthenticationOf } from "../elaborate/index.js";
import {
  deepestViolationsOf,
  definitionsUri,
  standardSchemas,
} from "../grammar/index.js";

const policyUri = `${definitionsUri}/authenticationPolicy`;

export class SecretPolicyCheck implements SecretPolicies {
  readonly #policy: Validator;

  static standard(): SecretPolicyCheck {
    const registry = standardSchemas();
    return new SecretPolicyCheck(registry);
  }

  constructor(schemas: SchemaReferences) {
    this.#policy = schemas.validatorOf(policyUri);
  }

  authenticationOf(
    scheme: AuthenticationScheme,
    secret: JsonValue,
    profile: HostProfile,
  ): ResolvedAuthentication | SecretRefusal {
    const policy = { [scheme]: secret };
    const violations = this.#policy(policy);
    const [violation] = deepestViolationsOf(violations);

    if (violation !== undefined) {
      return this.#refusalOf(violation.message);
    }

    const isReference = isJsonObject(secret) && Object.hasOwn(secret, "use");

    if (isReference) {
      return this.#refusalOf("A secret holds its policy, not another secret.");
    }

    const authentication = heldAuthenticationOf(scheme, secret);

    return this.#grantedOf(authentication, profile);
  }

  #grantedOf(
    authentication: ResolvedAuthentication,
    profile: HostProfile,
  ): ResolvedAuthentication | SecretRefusal {
    switch (authentication.kind) {
      case "basic":
      case "digest":
      case "bearer":
        return authentication;
      case "oauth2":
      case "oidc": {
        const { grant } = authentication;
        const isGranted = profile.grants.includes(grant);

        if (!isGranted) {
          return this.#refusalOf(`The host does not provide '${grant}'.`);
        }

        return authentication;
      }
    }
  }

  #refusalOf(reason: string): SecretRefusal {
    return { kind: "refused", reason };
  }
}
