import { Expression } from './expression.js';
import type {
  DataSpecProps,
  JsonObject,
  ParsedInput,
  ParsedOutput,
} from './interfaces.js';
import type { Scope } from './scope.js';
import { Template } from './template.js';

export class DataSpec {
  readonly #transform: Expression | Template | null;
  readonly #schema: JsonObject | null;

  constructor(props: DataSpecProps) {
    this.#transform = props.transform;
    this.#schema = props.schema;
  }

  static none(): DataSpec {
    return new DataSpec({ transform: null, schema: null });
  }

  static input(parsed: ParsedInput | undefined, scope: Scope): DataSpec {
    if (parsed === undefined) return DataSpec.none();

    const from = parsed.from;
    const fromAt = scope.at('from');
    const transform =
      typeof from === 'string'
        ? Expression.read(from, fromAt)
        : Template.read(from, fromAt);
    const schema = parsed.schema ?? null;
    return new DataSpec({ transform, schema });
  }

  static output(parsed: ParsedOutput | undefined, scope: Scope): DataSpec {
    if (parsed === undefined) return DataSpec.none();

    const as = parsed.as;
    const asAt = scope.at('as');
    const transform =
      typeof as === 'string'
        ? Expression.read(as, asAt)
        : Template.read(as, asAt);
    const schema = parsed.schema ?? null;
    return new DataSpec({ transform, schema });
  }

  get transform(): Expression | Template | null {
    return this.#transform;
  }

  get schema(): JsonObject | null {
    return this.#schema;
  }
}
