import { Injectable } from "@nestjs/common";
import type { HeldSecret } from "../../../domain/automation/secrets/interfaces.js";
import { Secret } from "../../../domain/automation/secrets/secret.js";
import { SecretValue } from "../../../domain/automation/secrets/secret-value.js";
import { Cipher, type SealedSecretRow, type SecretRow } from "../interfaces.js";

@Injectable()
export class SecretMapper {
  constructor(private readonly cipher: Cipher) {}

  toRow(secret: Secret): SecretRow {
    const sealed = this.cipher.seal(secret.value.text);
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

  toEntity(row: SecretRow): Secret {
    const value = this.#valueOf(row.sealed);
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

  heldOf(row: SealedSecretRow): HeldSecret {
    const value = this.#valueOf(row.sealed);
    return { name: row.name, value };
  }

  #valueOf(sealed: string): SecretValue {
    const text = this.cipher.open(sealed);
    return new SecretValue(text);
  }
}
