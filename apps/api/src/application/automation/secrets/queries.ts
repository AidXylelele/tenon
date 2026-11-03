export interface SecretView {
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export abstract class SecretQueries {
  // The owner's secrets by name; never their values.
  abstract list(ownerId: string): Promise<SecretView[]>;
  abstract namesOf(ownerId: string): Promise<string[]>;
  // The value of the owner's secret as kept now, or null when it does not exist (any more) or
  // none is named.
  abstract valueOf(
    ownerId: string,
    name: string | null,
  ): Promise<string | null>;
  // The values of these secrets of the publisher of the instance's version, as kept now: a
  // replaced value is the one read next, a deleted secret is missing (US8).
  abstract valuesFor(
    instanceId: string,
    names: readonly string[],
  ): Promise<Record<string, string>>;
}
