import { InconsistentProgressError } from '../../../../domain/errors.js';

export class InstantMapper {
  static readonly #NOT_A_TIME = 'a stored instant is not a time';

  static toState(instant: Date): string;
  static toState(instant: Date | null): string | null;
  static toState(instant: Date | null): string | null {
    if (instant === null) return null;

    return instant.toISOString();
  }

  static toDomain(state: string): Date;
  static toDomain(state: string | null): Date | null;
  static toDomain(state: string | null): Date | null {
    if (state === null) return null;

    const instant = new Date(state);
    const time = instant.getTime();

    // jsonb is where corrupt state comes in: refused when read, not when written back.
    if (Number.isNaN(time))
      throw new InconsistentProgressError(InstantMapper.#NOT_A_TIME);

    return instant;
  }
}
