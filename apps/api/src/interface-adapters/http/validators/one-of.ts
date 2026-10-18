import { registerDecorator, type ValidationOptions } from 'class-validator';

export function OneOf(
  keys: readonly string[],
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) => {
    const propertyName = String(property);
    const choices = keys.join(', ');
    registerDecorator({
      name: 'oneOf',
      target: target.constructor,
      propertyName,
      options: {
        message: `$property must have exactly one of ${choices}`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => {
          if (value === null || typeof value !== 'object') return false;

          const present = keys.filter(
            (key) => (value as Record<string, unknown>)[key] !== undefined,
          );
          return present.length === 1;
        },
      },
    });
  };
}
