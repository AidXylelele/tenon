import { AesGcmSecretCipher } from '../../../src/interface-adapters/security/aes-gcm-secret.cipher.js';

const KEY_1 = `old:${Buffer.alloc(32, 1).toString('base64')}`;
const KEY_2 = `new:${Buffer.alloc(32, 2).toString('base64')}`;

describe('AesGcmSecretCipher', () => {
  it('a_secret_is_encrypted_with_the_current_key_and_decrypted_back', () => {
    const cipher = new AesGcmSecretCipher([KEY_1, KEY_2], 'new');
    const encrypted = cipher.encrypt('s3cret');
    expect(encrypted.keyVersion).toBe('new');
    expect(encrypted.ciphertext).not.toContain('s3cret');
    expect(cipher.decrypt(encrypted)).toBe('s3cret');
    expect(cipher.encrypt('s3cret').ciphertext).not.toBe(encrypted.ciphertext);
  });

  it('a_secret_of_a_retired_key_is_read_while_the_key_is_configured', () => {
    const before = new AesGcmSecretCipher([KEY_1], 'old');
    const encrypted = before.encrypt('s3cret');
    expect(
      new AesGcmSecretCipher([KEY_1, KEY_2], 'new').decrypt(encrypted),
    ).toBe('s3cret');
    expect(
      new AesGcmSecretCipher([KEY_2], 'new').decrypt(encrypted),
    ).toBeNull();
  });

  it('a_tampered_secret_is_unreadable', () => {
    const cipher = new AesGcmSecretCipher([KEY_1], 'old');
    const encrypted = cipher.encrypt('s3cret');
    const bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    expect(
      cipher.decrypt({ ...encrypted, ciphertext: bytes.toString('base64') }),
    ).toBeNull();
  });

  it('the_current_key_must_be_configured', () => {
    expect(() => new AesGcmSecretCipher([KEY_1], 'new')).toThrow();
  });
});
