import { registerDecorator, type ValidationOptions } from 'class-validator';

export class JsonLimits {
  static readonly DEPTH = 64;

  static depthOf(value: unknown): number {
    if (value === null || typeof value !== 'object') return 0;

    let deepest = 0;

    for (const child of Object.values(value)) {
      const depth = JsonLimits.depthOf(child);
      deepest = Math.max(deepest, depth);

      if (deepest > JsonLimits.DEPTH) break;
    }

    return deepest + 1;
  }

  static bytesOf(value: unknown): number {
    const text = JSON.stringify(value) ?? '';
    return Buffer.byteLength(text);
  }
}

export function MaxJsonDepth(
  depth: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) => {
    const propertyName = String(property);
    registerDecorator({
      name: 'maxJsonDepth',
      target: target.constructor,
      propertyName,
      options: {
        message: `$property must nest at most ${depth} levels`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => JsonLimits.depthOf(value) <= depth,
      },
    });
  };
}

export function MaxJsonBytes(
  bytes: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) => {
    const propertyName = String(property);
    registerDecorator({
      name: 'maxJsonBytes',
      target: target.constructor,
      propertyName,
      options: {
        message: `$property must be at most ${bytes} bytes`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => JsonLimits.bytesOf(value) <= bytes,
      },
    });
  };
}
