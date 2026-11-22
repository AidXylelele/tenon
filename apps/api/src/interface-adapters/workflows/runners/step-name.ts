export class StepName {
  private static readonly EFFECT = "effect";
  private static readonly SEPARATOR = /[#:]/;

  constructor(private readonly name: string) {}

  kind(): string {
    const effect = this.name.startsWith("/");

    if (effect) return StepName.EFFECT;

    const separator = this.name.search(StepName.SEPARATOR);

    if (separator === -1) return this.name;

    return this.name.slice(0, separator);
  }
}
