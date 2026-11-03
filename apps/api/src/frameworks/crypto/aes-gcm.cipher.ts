import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Cipher } from '../../interface-adapters/persistence/interfaces.js';

// AES-256-GCM (node:crypto) with a random 96-bit IV per value: the sealed text is the IV, the
// authentication tag and the ciphertext, base64, so a changed value fails to open.
export class AesGcmCipher implements Cipher {
  static readonly #ALGORITHM = 'aes-256-gcm';
  static readonly #IV_BYTES = 12;
  static readonly #TAG_BYTES = 16;

  readonly #key: Buffer;

  constructor(base64Key: string) {
    this.#key = Buffer.from(base64Key, 'base64');
  }

  seal(value: string): string {
    const iv = randomBytes(AesGcmCipher.#IV_BYTES);
    const cipher = createCipheriv(AesGcmCipher.#ALGORITHM, this.#key, iv);
    const head = cipher.update(value, 'utf8');
    const tail = cipher.final();
    const tag = cipher.getAuthTag();
    const sealed = Buffer.concat([iv, tag, head, tail]);
    return sealed.toString('base64');
  }

  open(sealed: string): string {
    const bytes = Buffer.from(sealed, 'base64');
    const tagEnd = AesGcmCipher.#IV_BYTES + AesGcmCipher.#TAG_BYTES;
    const iv = bytes.subarray(0, AesGcmCipher.#IV_BYTES);
    const tag = bytes.subarray(AesGcmCipher.#IV_BYTES, tagEnd);
    const body = bytes.subarray(tagEnd);
    const decipher = createDecipheriv(AesGcmCipher.#ALGORITHM, this.#key, iv);
    decipher.setAuthTag(tag);
    const head = decipher.update(body, undefined, 'utf8');
    const tail = decipher.final('utf8');
    return `${head}${tail}`;
  }
}
