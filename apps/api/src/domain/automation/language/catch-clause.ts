import { DefaultVariable } from './enums.js';
import type { ErrorFilter } from './error-filter.js';
import type { Expression } from './expression.js';
import type { CatchClauseProps } from './interfaces.js';
import type { RetryStrategy } from './retry-strategy.js';
import type { TaskList } from './task-list.js';

export class CatchClause {
  readonly #filter: ErrorFilter;
  readonly #as: string;
  readonly #when: Expression | null;
  readonly #exceptWhen: Expression | null;
  readonly #retry: RetryStrategy | null;
  readonly #handler: TaskList | null;

  constructor(props: CatchClauseProps) {
    this.#filter = props.filter;
    this.#as = props.as ?? DefaultVariable.Error;
    this.#when = props.when;
    this.#exceptWhen = props.exceptWhen;
    this.#retry = props.retry;
    this.#handler = props.handler;
  }

  get filter(): ErrorFilter {
    return this.#filter;
  }

  get as(): string {
    return this.#as;
  }

  get when(): Expression | null {
    return this.#when;
  }

  get exceptWhen(): Expression | null {
    return this.#exceptWhen;
  }

  get retry(): RetryStrategy | null {
    return this.#retry;
  }

  get handler(): TaskList | null {
    return this.#handler;
  }

  get expressions(): readonly Expression[] {
    const when = this.#when?.expressions ?? [];
    const exceptWhen = this.#exceptWhen?.expressions ?? [];
    const retry = this.#retry?.expressions ?? [];
    const handler = this.#handler?.expressions ?? [];
    return when.concat(exceptWhen, retry, handler);
  }
}
