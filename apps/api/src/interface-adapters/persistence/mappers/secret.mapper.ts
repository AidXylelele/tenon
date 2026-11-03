import { Secret } from '../../../domain/automation/secrets/secret.js';
import type { Cipher, SecretRow } from '../interfaces.js';

// A secret's row holds its value sealed; only this mapper opens it.
export class SecretMapper {
  static toRow(secret: Secret, cipher: Cipher): SecretRow {
    const sealed = cipher.seal(secret.value);
    return {
      id: secret.id,
      ownerId: secret.ownerId,
      name: secret.name,
      sealed,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      version: secret.version,
    };
  }

  static toEntity(row: SecretRow, cipher: Cipher): Secret {
    const value = cipher.open(row.sealed);
    return new Secret({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }
}
