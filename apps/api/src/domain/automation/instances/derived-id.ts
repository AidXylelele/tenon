import { createHash } from 'node:crypto';

export class DerivedId {
  static readonly #NAMESPACE = Buffer.from(
    'c1f7a0e25b3d4f6a9e8c2d4b6a8f0e1c',
    'hex',
  );
  static readonly #VERSION_5 = 0x50;
  static readonly #VARIANT_RFC_4122 = 0x80;

  static of(parts: readonly string[]): string {
    const name = JSON.stringify(parts);
    const digest = createHash('sha1')
      .update(DerivedId.#NAMESPACE)
      .update(name, 'utf8')
      .digest();
    const bytes = digest.subarray(0, 16);
    const versioned = (bytes.readUInt8(6) & 0x0f) | DerivedId.#VERSION_5;
    const variant = (bytes.readUInt8(8) & 0x3f) | DerivedId.#VARIANT_RFC_4122;
    bytes.writeUInt8(versioned, 6);
    bytes.writeUInt8(variant, 8);
    const hex = bytes.toString('hex');
    const groups = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ];
    return groups.join('-');
  }
}
