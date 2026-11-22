export abstract class Cipher {
  abstract seal(value: string): string;
  abstract open(sealed: string): string;
}
