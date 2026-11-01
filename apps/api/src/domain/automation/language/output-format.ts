import type { JsonValue } from './interfaces.js';
import type { ServiceResponded } from './results/service-responded.js';

export class OutputFormat {
  static readonly Raw = new OutputFormat('raw', (response) => response.content);
  static readonly Content = new OutputFormat(
    'content',
    (response) => response.content,
  );
  static readonly Response = new OutputFormat('response', (response) => ({
    request: response.request,
    headers: response.headers,
    statusCode: response.status,
    content: response.content,
  }));

  static readonly #values: readonly OutputFormat[] = [
    OutputFormat.Raw,
    OutputFormat.Content,
    OutputFormat.Response,
  ];

  readonly #name: string;
  readonly #select: (response: ServiceResponded) => JsonValue;

  private constructor(
    name: string,
    select: (response: ServiceResponded) => JsonValue,
  ) {
    this.#name = name;
    this.#select = select;
  }

  static named(name: string): OutputFormat | null {
    const found = OutputFormat.#values.find((value) => value.#name === name);
    return found ?? null;
  }

  outputOf(response: ServiceResponded): JsonValue {
    return this.#select(response);
  }
}
