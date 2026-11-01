import type { Authentication } from '../../../../../src/domain/automation/language/authentication.js';
import { ConstantBackoff } from '../../../../../src/domain/automation/language/backoffs/constant-backoff.js';
import type { ExpressionDuration } from '../../../../../src/domain/automation/language/expression-duration.js';
import type { FixedDuration } from '../../../../../src/domain/automation/language/fixed-duration.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { ErrorCondition } from '../../../../../src/domain/automation/language/error-condition.js';
import { RetryStrategy } from '../../../../../src/domain/automation/language/retry-strategy.js';
import { ReusableComponents } from '../../../../../src/domain/automation/language/reusable-components.js';
import type { Task } from '../../../../../src/domain/automation/language/tasks/task.js';
import type { Template } from '../../../../../src/domain/automation/language/template.js';
import {
  FunctionJumpError,
  UndeclaredComponentError,
} from '../../../../../src/domain/errors.js';
import { callTask, rejectionOf } from '../../../../support/language.js';

function componentsWith(
  retries: ReadonlyMap<string, RetryStrategy>,
  functions: ReadonlyMap<string, Task>,
): ReusableComponents {
  return new ReusableComponents({
    authentications: new Map<string, Authentication>(),
    errors: new Map<string, Template>(),
    retries,
    timeouts: new Map<string, FixedDuration | ExpressionDuration>(),
    functions,
  });
}

describe('ReusableComponents', () => {
  const functionsAt = JsonPointer.root().at('use').at('functions');
  const retryAt = JsonPointer.root()
    .at('do')
    .at(0)
    .at('guarded')
    .at('catch')
    .at('retry');
  const fast = new RetryStrategy({
    condition: ErrorCondition.none(),
    delay: null,
    backoff: new ConstantBackoff(),
    attemptCount: 3,
    totalDuration: null,
    jitterFrom: null,
    jitterTo: null,
  });

  it('a_declared_component_is_found_by_name', () => {
    const components = componentsWith(new Map([['fast', fast]]), new Map());

    expect(components.retry('fast', retryAt)).toBe(fast);
  });

  it('a_name_that_use_does_not_declare_is_refused_where_it_is_named', () => {
    const components = ReusableComponents.none();

    const rejection = rejectionOf(() => components.retry('fast', retryAt));

    expect(rejection).toBeInstanceOf(UndeclaredComponentError);
    expect(rejection.message).toBe('"fast" is not declared in use.retries');
    expect(rejection.pointer).toBe('/do/0/guarded/catch/retry');
  });

  it('a_declared_function_calling_an_undeclared_function_is_refused', () => {
    const caller = callTask(functionsAt.at('charge'), 'charge', 'settle');
    const components = componentsWith(new Map(), new Map([['charge', caller]]));

    const rejection = rejectionOf(() => {
      components.confirmCalls();
    });

    expect(rejection).toBeInstanceOf(UndeclaredComponentError);
    expect(rejection.pointer).toBe('/use/functions/charge/call');
  });

  it('a_declared_function_going_to_a_named_task_is_refused', () => {
    const charge = callTask(functionsAt.at('charge'), 'charge', 'settle', 'x');
    const settle = callTask(
      functionsAt.at('settle'),
      'settle',
      'charge',
      'end',
    );
    const functions = new Map<string, Task>([
      ['charge', charge],
      ['settle', settle],
    ]);

    const rejection = rejectionOf(() => componentsWith(new Map(), functions));

    expect(rejection).toBeInstanceOf(FunctionJumpError);
    expect(rejection.pointer).toBe('/use/functions/charge/then');
  });

  it('declared_functions_may_call_each_other', () => {
    const charge = callTask(functionsAt.at('charge'), 'charge', 'settle');
    const settle = callTask(functionsAt.at('settle'), 'settle', 'charge');
    const functions = new Map<string, Task>([
      ['charge', charge],
      ['settle', settle],
    ]);
    const components = componentsWith(new Map(), functions);

    expect(() => {
      components.confirmCalls();
    }).not.toThrow();
  });
});
