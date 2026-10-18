import type {
  FieldShape,
  FieldType,
  Item,
} from '../../application/interfaces.js';

export class FieldShapes {
  static readonly ITEMS = 20;
  static readonly PATHS = 500;

  readonly #shapes: FieldShape[] = [];

  static of(items: readonly Item[]): FieldShape[] {
    const shapes = new FieldShapes();

    for (const item of items.slice(0, FieldShapes.ITEMS)) {
      shapes.collect(item, '');
    }

    return shapes.#shapes;
  }

  private collect(
    value: Readonly<Record<string, unknown>>,
    prefix: string,
  ): void {
    for (const [key, field] of Object.entries(value)) {
      if (this.#shapes.length >= FieldShapes.PATHS) return;

      const path = prefix === '' ? key : `${prefix}.${key}`;
      const type = FieldShapes.typeOf(field);

      const known = this.#shapes.some((shape) => shape.path === path);

      if (!known) {
        this.#shapes.push({ path, type });
      }

      if (type === 'object') {
        this.collect(field as Record<string, unknown>, path);
      }
    }
  }

  private static typeOf(value: unknown): FieldType {
    if (value === null) return 'null';

    const isArray = Array.isArray(value);

    if (isArray) return 'array';

    if (typeof value === 'object') return 'object';

    if (typeof value === 'number') return 'number';

    if (typeof value === 'boolean') return 'boolean';

    return 'string';
  }
}
