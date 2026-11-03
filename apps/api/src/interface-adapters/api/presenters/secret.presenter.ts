import type { SecretView } from '../../../application/automation/secrets/queries.js';
import type { Secret } from '../../../domain/automation/secrets/secret.js';
import type {
  SecretListResponse,
  SecretResponse,
} from '../schemas/secret.schemas.js';

export class SecretPresenter {
  static secret(secret: Secret | SecretView): SecretResponse {
    return {
      name: secret.name,
      createdAt: secret.createdAt.toISOString(),
      updatedAt: secret.updatedAt.toISOString(),
    };
  }

  static list(views: readonly SecretView[]): SecretListResponse {
    return views.map((view) => SecretPresenter.secret(view));
  }
}
