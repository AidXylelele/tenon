export function isMemberOf<Member extends string>(
  catalogue: readonly Member[],
  value: unknown,
): value is Member {
  return catalogue.some((member) => member === value);
}
