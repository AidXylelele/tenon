import type { InstancePosition } from '../../../application/automation/instances/queries.js';

// The API's opaque page tokens: the last start time in milliseconds and id, or the last position.
export class CursorMapper {
  static readonly #SEPARATOR = '_';

  static toInstancePosition(
    cursor: string | undefined,
  ): InstancePosition | null {
    if (cursor === undefined) return null;

    const [epoch = '', id = ''] = cursor.split(CursorMapper.#SEPARATOR);
    const milliseconds = Number(epoch);
    const startedAt = new Date(milliseconds);
    return { startedAt, id };
  }

  static fromInstancePosition(
    position: InstancePosition | null,
  ): string | null {
    if (position === null) return null;

    const milliseconds = String(position.startedAt.getTime());
    return `${milliseconds}${CursorMapper.#SEPARATOR}${position.id}`;
  }

  static toPosition(cursor: string | undefined): number | null {
    if (cursor === undefined) return null;

    return Number(cursor);
  }

  static fromPosition(position: number | null): string | null {
    if (position === null) return null;

    return String(position);
  }
}
