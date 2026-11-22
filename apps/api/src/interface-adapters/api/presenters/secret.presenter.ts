import { Injectable } from "@nestjs/common";
import type {
  ListedSecret,
  SecretUse,
  SecretView,
} from "../../../application/automation/secrets/interfaces.js";
import type {
  SecretListResponse,
  SecretResponse,
} from "../schemas/secret.schemas.js";

@Injectable()
export class SecretPresenter {
  secret(secret: SecretView): SecretResponse {
    return {
      name: secret.name,
      createdAt: secret.createdAt.toISOString(),
      updatedAt: secret.updatedAt.toISOString(),
    };
  }

  list(listed: readonly ListedSecret[]): SecretListResponse {
    return listed.map((secret) => ({
      name: secret.name,
      createdAt: secret.createdAt.toISOString(),
      updatedAt: secret.updatedAt.toISOString(),
      usedBy: this.#usesOf(secret.usedBy),
    }));
  }

  #usesOf(uses: readonly SecretUse[]): SecretListResponse[number]["usedBy"] {
    return uses.map((use) => ({
      namespace: use.namespace,
      name: use.name,
      version: use.version,
    }));
  }
}
