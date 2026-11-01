export class InstantMapper {
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

    return new Date(state);
  }
}
