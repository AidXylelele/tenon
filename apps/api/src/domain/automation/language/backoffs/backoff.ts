export abstract class Backoff {
  abstract delayFor(delay: number, attempt: number): number;
}
