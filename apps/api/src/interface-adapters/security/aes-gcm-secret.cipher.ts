import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SecretCipher } from '../../application/interfaces.js';
import type { EncryptedSecret } from '../../domain/interfaces.js';

export class AesGcmSecretCipher extends SecretCipher {
  static readonly ALGORITHM = 'aes-256-gcm';
  static readonly IV_BYTES = 12;
  static readonly TAG_BYTES = 16;

  readonly #keys = new Map<string, Buffer>();
  readonly #current: string;

  constructor(keys: readonly string[], current: string) {
    super();

    for (const entry of keys) {
      const separator = entry.indexOf(':');
      const encodedStart = separator + 1;
      const version = entry.slice(0, separator);
      const encoded = entry.slice(encodedStart);
      const key = Buffer.from(encoded, 'base64');
      this.#keys.set(version, key);
    }

    const configured = this.#keys.has(current);

    if (!configured) {
      throw new Error(`The current secret key ${current} is not configured`);
    }

    this.#current = current;
  }

  encrypt(plain: string): EncryptedSecret {
    const iv = randomBytes(AesGcmSecretCipher.IV_BYTES);
    const key = this.#keys.get(this.#current)!;
    const cipher = createCipheriv(AesGcmSecretCipher.ALGORITHM, key, iv);
    const encrypted = cipher.update(plain, 'utf8');
    const remainder = cipher.final();
    const data = Buffer.concat([encrypted, remainder]);
    const tag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([iv, tag, data]).toString('base64');
    return { ciphertext, keyVersion: this.#current };
  }

  decrypt(secret: EncryptedSecret): string | null {
    const key = this.#keys.get(secret.keyVersion);

    if (!key) return null;

    const bytes = Buffer.from(secret.ciphertext, 'base64');
    const tagEnd = AesGcmSecretCipher.IV_BYTES + AesGcmSecretCipher.TAG_BYTES;
    const iv = bytes.subarray(0, AesGcmSecretCipher.IV_BYTES);
    const tag = bytes.subarray(AesGcmSecretCipher.IV_BYTES, tagEnd);
    const decipher = createDecipheriv(AesGcmSecretCipher.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    try {
      const data = bytes.subarray(tagEnd);
      const decrypted = decipher.update(data);
      const remainder = decipher.final();
      const plain = Buffer.concat([decrypted, remainder]);
      return plain.toString('utf8');
    } catch {
      return null;
    }
  }
}
