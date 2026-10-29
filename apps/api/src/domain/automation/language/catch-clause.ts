import { ErrorFilter } from './error-filter.js';
import { Expression } from './expression.js';
import type { CatchClauseProps, ParsedCatch } from './interfaces.js';
import { RetryPolicy } from './retry-policy.js';
import type { Scope } from './scope.js';
import { TaskList } from './task-list.js';

export class CatchClause {
  readonly #filter: ErrorFilter;
  readonly #as: string;
  readonly #when: Expression | null;
  readonly #exceptWhen: Expression | null;
  readonly #retry: RetryPolicy | null;
  readonly #handler: TaskList | null;

  constructor(props: CatchClauseProps) {
    this.#filter = props.filter;
    this.#as = props.as;
    this.#when = props.when;
    this.#exceptWhen = props.exceptWhen;
    this.#retry = props.retry;
    this.#handler = props.handler;
  }

  static read(parsed: ParsedCatch, scope: Scope): CatchClause {
    const as = parsed.as ?? 'error';
    const caughtAs = [as];
    const caught = scope.declaring(caughtAs);
    const whenAt = caught.at('when');
    const exceptWhenAt = caught.at('exceptWhen');
    const retryAt = caught.at('retry');
    const handlerAt = caught.at('do');
    const filter = ErrorFilter.read(parsed.errors);
    const when = Expression.read(parsed.when, whenAt);
    const exceptWhen = Expression.read(parsed.exceptWhen, exceptWhenAt);
    const retry = RetryPolicy.resolve(parsed.retry, retryAt);
    const handler = TaskList.read(parsed.do, handlerAt);
    return new CatchClause({ filter, as, when, exceptWhen, retry, handler });
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

  get retry(): RetryPolicy | null {
    return this.#retry;
  }

  get handler(): TaskList | null {
    return this.#handler;
  }
}
