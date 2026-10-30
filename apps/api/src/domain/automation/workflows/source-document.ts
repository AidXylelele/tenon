import { createHash } from 'node:crypto';
import { VersionConflictError } from '../../errors.js';
import type { DocumentFormat } from './enums.js';
import type { SourceDocumentProps } from './interfaces.js';

export class SourceDocument {
  readonly #format: DocumentFormat;
  readonly #text: string;
  readonly #fingerprint: string;

  constructor(props: SourceDocumentProps) {
    this.#format = props.format;
    this.#text = props.text;
    this.#fingerprint = props.fingerprint;
  }

  static of(format: DocumentFormat, text: string): SourceDocument {
    const fingerprint = createHash('sha256').update(text).digest('hex');
    return new SourceDocument({ format, text, fingerprint });
  }

  get format(): DocumentFormat {
    return this.#format;
  }

  get text(): string {
    return this.#text;
  }

  get fingerprint(): string {
    return this.#fingerprint;
  }

  confirmSame(other: SourceDocument): void {
    if (this.#fingerprint !== other.#fingerprint)
      throw new VersionConflictError();
  }
}
